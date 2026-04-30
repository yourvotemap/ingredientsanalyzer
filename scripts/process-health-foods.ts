/**
 * 機能性表示食品データ処理スクリプト
 *
 * 入力: data/機能性表示食品_検索結果一覧/ 以下のCSVファイル
 *   （消費者庁の届出データ一覧）
 *
 * 期待するCSV列（消費者庁の公式フォーマット）:
 *   届出番号, 商品名, 届出者名, 機能性関与成分名, 表示しようとする機能性, ...
 *
 * 処理内容:
 *   1. 「機能性関与成分名」から成分を抽出
 *   2. 成分を大本の素材（baseIngredient）に分類（マッピングテーブルを使用）
 *   3. 機能性テキストから各スコア軸のキーワードを検出してスコアを付与
 *   4. 既存のIngredientレコードを更新 or 新規登録
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

const DATA_DIR = path.join(__dirname, "../data/機能性表示食品_検索結果一覧");

// -------------------------------------------------------------------
// 大本の素材マッピング
// キー: 成分名に含まれるキーワード（部分一致）
// 値: baseIngredient（表示名）
// -------------------------------------------------------------------
const BASE_INGREDIENT_MAP: [RegExp, string][] = [
  // 植物由来
  [/りんご|林檎|アップル|プロシアニジン/i, "りんご"],
  [/ブルーベリー|ビルベリー|アントシアニン/i, "ブルーベリー"],
  [/ブドウ|葡萄|グレープ|レスベラトロール/i, "ブドウ"],
  [/トマト|リコピン/i, "トマト"],
  [/緑茶|カテキン|テアニン/i, "緑茶"],
  [/大豆|ソイ|イソフラボン|ナットウ|納豆|ナットウキナーゼ/i, "大豆"],
  [/ウコン|クルクミン|ターメリック/i, "ウコン"],
  [/にんにく|ガーリック|アリシン/i, "にんにく"],
  [/ショウガ|生姜|ジンジャー|ジンゲロール/i, "しょうが"],
  [/ゴマ|胡麻|セサミン/i, "ごま"],
  [/コーヒー|クロロゲン酸/i, "コーヒー"],
  [/カカオ|ポリフェノール.*カカオ|チョコレート/i, "カカオ"],
  [/ローズ|バラ/i, "バラ"],
  [/ヒハツ|長胡椒/i, "ヒハツ"],
  [/もろみ酢/i, "もろみ酢"],
  [/クロス|黒酢/i, "黒酢"],
  [/ビフィズス菌|乳酸菌|プロバイオティクス/i, "乳酸菌・ビフィズス菌"],
  [/難消化性デキストリン|食物繊維/i, "食物繊維"],
  [/コラーゲン/i, "コラーゲン"],
  [/ヒアルロン酸/i, "ヒアルロン酸"],
  [/CoQ10|コエンザイムQ/i, "コエンザイムQ10"],
  [/EPA|DHA|オメガ3|魚油/i, "魚油（EPA・DHA）"],
  [/GABA|ギャバ/i, "GABA"],
  [/ルテイン|ゼアキサンチン/i, "マリーゴールド（ルテイン）"],
  [/亜鉛|Zn/i, "亜鉛"],
  [/マグネシウム/i, "マグネシウム"],
  [/鉄分?|Fe/i, "鉄"],
  [/ビタミンD/i, "ビタミンD"],
  [/ビタミンC/i, "ビタミンC"],
  [/ビタミンE/i, "ビタミンE"],
  [/イチョウ葉|ギンコ/i, "イチョウ葉"],
  [/高麗人参|朝鮮人参|ジンセノサイド/i, "高麗人参"],
  [/プラセンタ/i, "プラセンタ"],
  [/エラスチン/i, "エラスチン"],
  [/フィッシュコラーゲン/i, "魚コラーゲン"],
  [/N-アセチルグルコサミン|グルコサミン/i, "グルコサミン"],
  [/コンドロイチン/i, "コンドロイチン"],
  [/メラトニン/i, "メラトニン"],
  [/アシュワガンダ/i, "アシュワガンダ"],
  [/クレアチン/i, "クレアチン"],
  [/テストステロン|マカ/i, "マカ"],
  [/カルニチン/i, "カルニチン"],
  [/シトルリン/i, "シトルリン"],
  [/ケルセチン/i, "ケルセチン"],
  [/フコキサンチン/i, "わかめ・海藻（フコキサンチン）"],
  [/β-グルカン|ベータグルカン/i, "β-グルカン"],
  [/乳清|ホエイ/i, "ホエイプロテイン"],
  [/大麦β|大麦/i, "大麦"],
];

function inferBaseIngredient(ingredientName: string): string {
  for (const [pattern, base] of BASE_INGREDIENT_MAP) {
    if (pattern.test(ingredientName)) return base;
  }
  // マッチしない場合は成分名を短縮して使う
  return ingredientName.replace(/[（(].*?[）)]/g, "").trim().slice(0, 20);
}

// -------------------------------------------------------------------
// 機能性テキスト → スコアキーワードマッピング
// -------------------------------------------------------------------
const FUNCTION_SCORE_MAP: Record<string, string[]> = {
  gut: ["腸内", "腸活", "便通", "便秘", "整腸", "プレバイオ", "プロバイオ", "腸内フローラ"],
  beauty: ["美容", "素肌", "肌の", "コラーゲン", "ヒアルロン酸", "潤い", "うるおい"],
  rest: ["睡眠", "入眠", "眠り", "休息", "リラックス", "GABA", "ストレス"],
  vitality: ["活力", "エネルギー", "疲労感", "スタミナ", "パワー"],
  circulation: ["血行", "血流", "巡り", "冷え", "末梢", "血管"],
  antiFatigue: ["疲労", "だるさ", "疲れ", "抗疲労"],
  concentration: ["集中", "記憶", "認知機能", "勉強", "仕事"],
  immunity: ["免疫", "感染", "風邪", "インフルエンザ", "ウイルス"],
  cognitive: ["認知機能", "記憶力", "物忘れ", "脳", "判断力"],
  joint: ["関節", "軟骨", "ひざ", "膝", "歩行"],
  muscle: ["筋肉", "筋力", "サルコペニア", "たんぱく質"],
  antioxidant: ["抗酸化", "酸化ストレス", "活性酸素"],
  antiObesity: ["体重", "体脂肪", "肥満", "ダイエット", "内臓脂肪"],
  health: ["健康", "血糖値", "血圧", "中性脂肪", "コレステロール"],
  menopause: ["更年期", "ホットフラッシュ", "のぼせ"],
  liver: ["肝機能", "肝臓", "ALT", "AST"],
  hairGrowth: ["育毛", "発毛", "抜け毛", "頭皮"],
  maleHealth: ["男性", "精力", "テストステロン"],
};

function inferScores(functionalityText: string): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const [field, keywords] of Object.entries(FUNCTION_SCORE_MAP)) {
    const hits = keywords.filter((kw) => functionalityText.includes(kw)).length;
    if (hits > 0) {
      scores[field] = Math.min(hits * 5, 30);
    }
  }
  return scores;
}

// -------------------------------------------------------------------
// CSV パーサー（消費者庁フォーマット対応）
// -------------------------------------------------------------------
interface HealthFoodRow {
  ingredientName: string;
  functionality: string;
  productName: string;
}

function parseCsv(content: string): HealthFoodRow[] {
  // BOM除去
  const cleaned = content.replace(/^﻿/, "");
  const rows = parse(cleaned, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  return rows
    .map((row) => {
      const ingredientName =
        row["機能性関与成分名"] ||
        row["関与成分"] ||
        row["素材"] ||
        row["ingredient"] ||
        "";
      const functionality =
        row["表示しようとする機能性"] ||
        row["機能性"] ||
        row["function"] ||
        row["効果"] ||
        "";
      const productName =
        row["商品名"] ||
        row["product_name"] ||
        row["name"] ||
        "";
      return { ingredientName: ingredientName.trim(), functionality: functionality.trim(), productName };
    })
    .filter((r) => r.ingredientName);
}

// -------------------------------------------------------------------
// 成分名を分割（複数成分が「/」「・」「、」で並ぶ場合）
// -------------------------------------------------------------------
function splitIngredientNames(raw: string): string[] {
  return raw
    .split(/[\/・、,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// -------------------------------------------------------------------
// DB更新
// -------------------------------------------------------------------
async function processHealthFoods(rows: HealthFoodRow[]) {
  // 成分ごとに集計
  const ingredientMap = new Map<string, { functionality: string[]; count: number }>();
  for (const row of rows) {
    const names = splitIngredientNames(row.ingredientName);
    for (const name of names) {
      if (!ingredientMap.has(name)) {
        ingredientMap.set(name, { functionality: [], count: 0 });
      }
      const entry = ingredientMap.get(name)!;
      if (row.functionality) entry.functionality.push(row.functionality);
      entry.count++;
    }
  }

  console.log(`\nユニーク成分数: ${ingredientMap.size}`);

  // 既存成分を取得
  const existing = await prisma.ingredient.findMany({
    where: { domain: { in: ["healthfood", "both"] } },
    select: { id: true, name: true, aliases: true },
  });

  let updated = 0;
  let created = 0;

  for (const [name, data] of ingredientMap) {
    const funcText = data.functionality.join(" ");
    const scores = inferScores(funcText);
    const baseIngredient = inferBaseIngredient(name);

    const match = existing.find((e) => {
      if (e.name === name) return true;
      if (e.aliases) {
        return e.aliases.split(/[、,]/).map((a) => a.trim()).includes(name);
      }
      return false;
    });

    if (match) {
      await prisma.ingredient.update({
        where: { id: match.id },
        data: { baseIngredient, usageCount: data.count, ...scores },
      });
      updated++;
    } else {
      await prisma.ingredient.create({
        data: {
          domain: "healthfood",
          name,
          baseIngredient,
          usageCount: data.count,
          short: funcText.slice(0, 100) || null,
          ...scores,
        },
      });
      created++;
    }
  }

  console.log(`更新: ${updated}件 / 新規登録: ${created}件`);
}

// -------------------------------------------------------------------
// メイン
// -------------------------------------------------------------------
async function main() {
  console.log("=== 機能性表示食品データ処理 ===");
  console.log(`データディレクトリ: ${DATA_DIR}`);

  if (!fs.existsSync(DATA_DIR)) {
    throw new Error(
      `データディレクトリが見つかりません: ${DATA_DIR}\n` +
      `data/機能性表示食品_検索結果一覧/ にCSVを配置してください。`
    );
  }

  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".csv") || f.endsWith(".tsv"))
    .map((f) => path.join(DATA_DIR, f));

  if (files.length === 0) {
    console.log("CSVファイルが見つかりません。");
    return;
  }
  console.log(`ファイル数: ${files.length}`);

  const allRows: HealthFoodRow[] = [];
  for (const file of files) {
    console.log(`  処理中: ${path.basename(file)}`);
    const content = fs.readFileSync(file, "utf-8");
    allRows.push(...parseCsv(content));
  }
  console.log(`総行数: ${allRows.length}`);

  await processHealthFoods(allRows);
  console.log("\n=== 完了 ===");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
