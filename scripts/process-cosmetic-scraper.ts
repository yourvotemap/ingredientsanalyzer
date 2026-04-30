/**
 * 化粧品スクレイパーデータ処理スクリプト
 *
 * 入力: data/cosmetic-scraper/cosmetic_ingredients/ 以下のCSV/JSONファイル
 *   - 各ファイルは製品1件分、または全製品まとめのCSV
 *
 * 期待するCSV列（どちらの形式でも可）:
 *   形式A: ingredient_name, product_count  （成分ごとの集計済みデータ）
 *   形式B: product_name, brand, ingredients （製品ごとのデータ、ingredientsは「,」区切り）
 *
 * 処理内容:
 *   1. 成分ごとに何製品で使われているかカウント → usageCount
 *   2. 既存のIngredientレコードを usageCount で更新
 *   3. DBにない成分は domain=cosmetics で新規登録
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

const DATA_DIR = path.join(__dirname, "../data/cosmetic-scraper/cosmetic_ingredients");

// -------------------------------------------------------------------
// CSV/JSON ローダー
// -------------------------------------------------------------------
function loadFiles(): string[] {
  if (!fs.existsSync(DATA_DIR)) {
    throw new Error(`データディレクトリが見つかりません: ${DATA_DIR}\ndata/cosmetic-scraper/cosmetic_ingredients/ にCSVまたはJSONを配置してください。`);
  }
  return fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".csv") || f.endsWith(".json"))
    .map((f) => path.join(DATA_DIR, f));
}

// -------------------------------------------------------------------
// 形式A: 成分名, 使用製品数 の集計済みCSV
// -------------------------------------------------------------------
function parseAggregatedCsv(content: string): Map<string, number> {
  const counts = new Map<string, number>();
  const rows = parse(content, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
  for (const row of rows) {
    // 列名の揺れに対応
    const name =
      row["ingredient_name"] ||
      row["成分名"] ||
      row["name"] ||
      row["inci"] ||
      "";
    const count = parseInt(
      row["product_count"] || row["使用製品数"] || row["count"] || "1",
      10
    );
    if (name.trim()) {
      counts.set(name.trim(), (counts.get(name.trim()) || 0) + count);
    }
  }
  return counts;
}

// -------------------------------------------------------------------
// 形式B: 製品ごとのCSV（ingredients列が「,」区切りの成分リスト）
// -------------------------------------------------------------------
function parseProductCsv(content: string): Map<string, number> {
  const counts = new Map<string, number>();
  const rows = parse(content, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
  for (const row of rows) {
    const ingredientsRaw =
      row["ingredients"] || row["全成分"] || row["成分"] || "";
    if (!ingredientsRaw) continue;
    const ingredients = ingredientsRaw
      .split(/[,、，\n]/)
      .map((s: string) => s.trim())
      .filter(Boolean);
    for (const ing of ingredients) {
      counts.set(ing, (counts.get(ing) || 0) + 1);
    }
  }
  return counts;
}

// -------------------------------------------------------------------
// JSON形式対応（オブジェクト配列を想定）
// -------------------------------------------------------------------
function parseJson(content: string): Map<string, number> {
  const counts = new Map<string, number>();
  const data = JSON.parse(content);
  const rows: Record<string, unknown>[] = Array.isArray(data) ? data : [data];
  for (const row of rows) {
    // 集計済み形式
    if (row["ingredient_name"] || row["成分名"] || row["name"]) {
      const name = String(row["ingredient_name"] || row["成分名"] || row["name"] || "").trim();
      const count = parseInt(String(row["product_count"] || row["count"] || "1"), 10);
      if (name) counts.set(name, (counts.get(name) || 0) + count);
    }
    // 製品形式
    else if (row["ingredients"] || row["全成分"]) {
      const raw = String(row["ingredients"] || row["全成分"] || "");
      raw.split(/[,、，\n]/).map((s) => s.trim()).filter(Boolean).forEach((ing) => {
        counts.set(ing, (counts.get(ing) || 0) + 1);
      });
    }
  }
  return counts;
}

// -------------------------------------------------------------------
// ファイル形式を自動判定してパース
// -------------------------------------------------------------------
function parseFile(filePath: string): Map<string, number> {
  const content = fs.readFileSync(filePath, "utf-8");
  if (filePath.endsWith(".json")) return parseJson(content);

  // CSVの場合: 1行目のヘッダーで形式を判定
  const firstLine = content.split("\n")[0].toLowerCase();
  if (
    firstLine.includes("ingredient_name") ||
    firstLine.includes("成分名") ||
    firstLine.includes("product_count")
  ) {
    return parseAggregatedCsv(content);
  }
  return parseProductCsv(content);
}

// -------------------------------------------------------------------
// 名前の正規化（INCI名・表記ゆれ対応）
// -------------------------------------------------------------------
function normalizeName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/　/g, " ");
}

// -------------------------------------------------------------------
// DB更新
// -------------------------------------------------------------------
async function updateUsageCounts(counts: Map<string, number>) {
  console.log(`\n成分ユニーク数: ${counts.size}`);

  // 既存成分を全取得（name + inci + aliases で照合）
  const existing = await prisma.ingredient.findMany({
    where: { domain: { in: ["cosmetics", "both", "quasidrug"] } },
    select: { id: true, name: true, inci: true, aliases: true },
  });

  let updated = 0;
  let created = 0;
  let skipped = 0;

  for (const [rawName, count] of counts) {
    const name = normalizeName(rawName);
    if (!name) { skipped++; continue; }

    // name / inci / aliases で検索
    const match = existing.find((e) => {
      if (e.name === name || e.inci === name) return true;
      if (e.aliases) {
        return e.aliases.split(/[、,]/).map((a) => a.trim()).includes(name);
      }
      return false;
    });

    if (match) {
      await prisma.ingredient.update({
        where: { id: match.id },
        data: { usageCount: count },
      });
      updated++;
    } else {
      // DBにない成分は最小情報で新規登録（スコアは0のまま、後でExcelで補完）
      await prisma.ingredient.create({
        data: {
          domain: "cosmetics",
          name,
          usageCount: count,
        },
      });
      created++;
    }
  }

  console.log(`更新: ${updated}件 / 新規登録: ${created}件 / スキップ: ${skipped}件`);
}

// -------------------------------------------------------------------
// メイン
// -------------------------------------------------------------------
async function main() {
  console.log("=== 化粧品スクレイパーデータ処理 ===");
  console.log(`データディレクトリ: ${DATA_DIR}`);

  const files = loadFiles();
  if (files.length === 0) {
    console.log(
      "CSVまたはJSONファイルが見つかりません。\n" +
      "data/cosmetic-scraper/cosmetic_ingredients/ にファイルを配置してください。"
    );
    return;
  }
  console.log(`ファイル数: ${files.length}`);

  // 全ファイルをマージ
  const totalCounts = new Map<string, number>();
  for (const file of files) {
    console.log(`  処理中: ${path.basename(file)}`);
    const counts = parseFile(file);
    for (const [name, count] of counts) {
      totalCounts.set(name, (totalCounts.get(name) || 0) + count);
    }
  }

  await updateUsageCounts(totalCounts);
  console.log("\n=== 完了 ===");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
