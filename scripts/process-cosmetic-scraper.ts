/**
 * 化粧品スクレイパーデータ処理スクリプト
 *
 * 入力: data/cosmetic-scraper/cosmetic_ingredients/ 以下のCSVファイル
 *
 * CSVカラム:
 *   id, name_jp, name_inci, component_number, definition, name_cn,
 *   purpose, regulation, cas_rn, organic_value, inorganic_value,
 *   notes, related_materials, commercial_products, external_links
 *
 * 処理内容:
 *   1. commercial_products → usageCount（数値なら直接、リストなら件数カウント）
 *   2. purpose（用途）→ タグ + 機能スコアに変換
 *   3. 既存のIngredientを name_jp / name_inci / aliases で照合して更新
 *   4. 未登録成分は domain=cosmetics で新規登録
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
// purpose（用途）→ スコアフィールドへのマッピング
// -------------------------------------------------------------------
const PURPOSE_SCORE_MAP: Array<{ patterns: RegExp[]; fields: Record<string, number> }> = [
  {
    patterns: [/保湿|湿潤|moistur|humectant/i],
    fields: { moisture: 20 },
  },
  {
    patterns: [/バリア|皮膜|エモリエント|emollient|barrier/i],
    fields: { barrier: 20 },
  },
  {
    patterns: [/美白|透明感|ブライトニング|brightening|whitening/i],
    fields: { brightening: 20, antiSpots: 15 },
  },
  {
    patterns: [/ハリ|リフト|firmness|lifting/i],
    fields: { firmness: 20 },
  },
  {
    patterns: [/鎮静|抗炎症|soothing|anti.?inflam/i],
    fields: { soothing: 20, antiInflammation: 20 },
  },
  {
    patterns: [/抗シワ|しわ|wrinkle|anti.?aging/i],
    fields: { antiWrinkle: 20, antiAging: 15 },
  },
  {
    patterns: [/抗ニキビ|ニキビ|acne|blemish/i],
    fields: { antiAcne: 20 },
  },
  {
    patterns: [/収れん|astringent|pore/i],
    fields: { astringent: 20 },
  },
  {
    patterns: [/ターンオーバー|turnover|exfoliat/i],
    fields: { turnover: 20 },
  },
  {
    patterns: [/シミ|くすみ|depigment|spot/i],
    fields: { antiSpots: 20 },
  },
  {
    patterns: [/抗酸化|酸化防止|antioxidant/i],
    fields: { antioxidant: 20 },
  },
  {
    patterns: [/消臭|deodorant/i],
    fields: { deodorant: 20 },
  },
  {
    patterns: [/育毛|発毛|hair.?growth/i],
    fields: { hairGrowth: 20 },
  },
  {
    patterns: [/抗菌|殺菌|antibacterial|antimicrobial/i],
    fields: { antibacterial: 20 },
  },
  {
    patterns: [/肌刺激|刺激性|irritat/i],
    fields: { skinIrritation: 20 },
  },
];

function inferScoresFromPurpose(purpose: string): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const { patterns, fields } of PURPOSE_SCORE_MAP) {
    if (patterns.some((p) => p.test(purpose))) {
      for (const [field, val] of Object.entries(fields)) {
        scores[field] = Math.max(scores[field] || 0, val);
      }
    }
  }
  return scores;
}

function purposeToTags(purpose: string): string {
  const tags: string[] = [];
  const tagMap: [RegExp, string][] = [
    [/保湿|湿潤|moistur|humectant/i, "保湿"],
    [/バリア|皮膜|エモリエント|emollient/i, "バリア"],
    [/美白|透明感|brightening|whitening/i, "透明感"],
    [/ハリ|リフト|firmness/i, "ハリ"],
    [/鎮静|抗炎症|soothing|anti.?inflam/i, "鎮静"],
    [/抗シワ|しわ|wrinkle/i, "抗シワ"],
    [/抗ニキビ|acne/i, "抗ニキビ"],
    [/収れん|astringent/i, "収れん"],
    [/ターンオーバー|turnover/i, "ターンオーバー"],
    [/シミ|くすみ|spot/i, "抗シミ"],
    [/抗酸化|antioxidant/i, "抗酸化"],
    [/消臭|deodorant/i, "消臭"],
    [/育毛|hair.?growth/i, "育毛"],
    [/抗菌|antibacterial/i, "抗菌"],
  ];
  for (const [pattern, tag] of tagMap) {
    if (pattern.test(purpose)) tags.push(tag);
  }
  return tags.join("、");
}

// -------------------------------------------------------------------
// commercial_products → usageCount
// 「123件」形式、純粋な数値、リスト形式に対応
// -------------------------------------------------------------------
function parseUsageCount(raw: string | undefined): number {
  if (!raw) return 0;
  const trimmed = raw.trim();
  if (!trimmed) return 0;

  // 「123件」「123 件」形式
  const kenMatch = trimmed.match(/^(\d[\d,]*)[\s　]*件/);
  if (kenMatch) return parseInt(kenMatch[1].replace(/,/g, ""), 10);

  // 純粋な数値（カンマ区切り数値表記も対応: 1,234）
  const numOnly = trimmed.replace(/,/g, "");
  const asNum = parseInt(numOnly, 10);
  if (!isNaN(asNum) && /^\d[\d,]*$/.test(trimmed)) return asNum;

  // セミコロン・改行・パイプ区切りのリスト
  const items = trimmed.split(/[;\n|]/).map((s) => s.trim()).filter(Boolean);
  if (items.length > 1) return items.length;

  return 1;
}

// -------------------------------------------------------------------
// メイン処理
// -------------------------------------------------------------------
interface CosmeticRow {
  name_jp: string;
  name_inci: string;
  name_cn: string;
  definition: string;
  purpose: string;
  cas_rn: string;
  notes: string;
  commercial_products: string;
}

async function processCosmeticIngredients(rows: CosmeticRow[]) {
  console.log(`\n成分行数: ${rows.length}`);

  // 既存成分を全取得
  const existing = await prisma.ingredient.findMany({
    where: { domain: { in: ["cosmetics", "both", "quasidrug"] } },
    select: { id: true, name: true, inci: true, aliases: true },
  });

  let updated = 0;
  let created = 0;
  let skipped = 0;

  const BATCH = 20;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const ops = [];

    for (const row of batch) {
      const name = (row.name_jp || "").trim();
      const inci = (row.name_inci || "").trim();
      if (!name && !inci) { skipped++; continue; }

      const usageCount = parseUsageCount(row.commercial_products);
      const scores = inferScoresFromPurpose(row.purpose || "");
      const tags = purposeToTags(row.purpose || "");

      const data = {
        domain: "cosmetics",
        name: name || inci,
        inci: inci || null,
        // INCI名は英語の国際標準名なので英語表示・英語一般名として兼用
        nameEn: inci || null,
        english: inci || null,
        nameZh: row.name_cn?.trim() || null,
        detail: row.definition?.trim() || null,
        notes: row.notes?.trim() || null,
        tags: tags || null,
        usageCount,
        ...scores,
      };

      const match = existing.find((e) => {
        if (name && (e.name === name)) return true;
        if (inci && (e.inci === inci || e.name === inci)) return true;
        if (e.aliases) {
          const aliasList = e.aliases.split(/[、,]/).map((a) => a.trim());
          if (name && aliasList.includes(name)) return true;
          if (inci && aliasList.includes(inci)) return true;
        }
        return false;
      });

      if (match) {
        ops.push(
          prisma.ingredient.update({ where: { id: match.id }, data })
        );
        updated++;
      } else {
        ops.push(prisma.ingredient.create({ data }));
        created++;
      }
    }

    if (ops.length > 0) {
      await prisma.$transaction(ops);
    }

    if ((i / BATCH) % 10 === 0) {
      process.stdout.write(`\r  処理済み: ${Math.min(i + BATCH, rows.length)} / ${rows.length}`);
    }
  }

  console.log(`\n更新: ${updated}件 / 新規登録: ${created}件 / スキップ: ${skipped}件`);
}

async function main() {
  console.log("=== 化粧品成分データ処理 ===");
  console.log(`データディレクトリ: ${DATA_DIR}`);

  if (!fs.existsSync(DATA_DIR)) {
    throw new Error(`データディレクトリが見つかりません: ${DATA_DIR}`);
  }

  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".csv"))
    .map((f) => path.join(DATA_DIR, f));

  if (files.length === 0) {
    throw new Error("CSVファイルが見つかりません。");
  }
  console.log(`ファイル数: ${files.length}`);

  const allRows: CosmeticRow[] = [];
  for (const file of files) {
    console.log(`  読み込み: ${path.basename(file)}`);
    // BOM除去 + タブ区切り/カンマ区切り両対応
    const raw = fs.readFileSync(file, "utf-8").replace(/^﻿/, "");
    const delimiter = raw.split("\n")[0].includes("\t") ? "\t" : ",";
    const rows = parse(raw, {
      columns: true,
      skip_empty_lines: true,
      delimiter,
      relax_column_count: true,
    }) as CosmeticRow[];
    allRows.push(...rows);
  }

  console.log(`総行数: ${allRows.length}`);
  await processCosmeticIngredients(allRows);
  console.log("=== 完了 ===");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
