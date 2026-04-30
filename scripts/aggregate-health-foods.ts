// 機能性表示食品CSVを集計してJSONに変換するスクリプト
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const BASE_INGREDIENT_MAP: [RegExp, string][] = [
  [/りんご|林檎|アップル|プロシアニジン/i, "りんご"],
  [/ブルーベリー|ビルベリー|アントシアニン.*ベリー/i, "ブルーベリー"],
  [/ブドウ|葡萄|グレープ|レスベラトロール/i, "ブドウ"],
  [/トマト|リコピン/i, "トマト"],
  [/緑茶|カテキン|テアニン/i, "緑茶"],
  [/大豆|ソイ|イソフラボン|ナットウキナーゼ|納豆/i, "大豆"],
  [/葛の花|クズ/i, "葛の花"],
  [/ウコン|クルクミン|ターメリック/i, "ウコン"],
  [/にんにく|ガーリック|アリシン/i, "にんにく"],
  [/ショウガ|生姜|ジンジャー|ジンゲロール/i, "しょうが"],
  [/ゴマ|胡麻|セサミン/i, "ごま"],
  [/コーヒー|クロロゲン酸/i, "コーヒー"],
  [/カカオ|チョコレート/i, "カカオ"],
  [/ヒハツ|長胡椒/i, "ヒハツ"],
  [/もろみ酢/i, "もろみ酢"],
  [/黒酢/i, "黒酢"],
  [/ビフィズス菌|乳酸菌|プロバイオティクス|有胞子性乳酸菌/i, "乳酸菌・ビフィズス菌"],
  [/難消化性デキストリン|食物繊維/i, "食物繊維（難消化性デキストリン）"],
  [/コラーゲン/i, "コラーゲン"],
  [/ヒアルロン酸/i, "ヒアルロン酸"],
  [/CoQ10|コエンザイムQ/i, "コエンザイムQ10"],
  [/EPA|DHA|オメガ3|魚油/i, "魚油（EPA・DHA）"],
  [/GABA|ギャバ/i, "GABA"],
  [/ルテイン|ゼアキサンチン/i, "マリーゴールド（ルテイン）"],
  [/亜鉛/i, "亜鉛"],
  [/マグネシウム/i, "マグネシウム"],
  [/鉄/i, "鉄"],
  [/ビタミンD/i, "ビタミンD"],
  [/ビタミンC/i, "ビタミンC"],
  [/ビタミンE/i, "ビタミンE"],
  [/イチョウ葉|ギンコ/i, "イチョウ葉"],
  [/高麗人参|朝鮮人参|ジンセノサイド/i, "高麗人参"],
  [/プラセンタ/i, "プラセンタ"],
  [/グルコサミン|N-アセチルグルコサミン/i, "グルコサミン"],
  [/コンドロイチン/i, "コンドロイチン"],
  [/アシュワガンダ/i, "アシュワガンダ"],
  [/シトルリン/i, "シトルリン"],
  [/ケルセチン/i, "ケルセチン"],
  [/β-グルカン|ベータグルカン/i, "β-グルカン"],
  [/大麦/i, "大麦"],
  [/もち麦/i, "もち麦"],
];

function inferBaseIngredient(name: string): string {
  for (const [pattern, base] of BASE_INGREDIENT_MAP) {
    if (pattern.test(name)) return base;
  }
  return name.replace(/[（(].*?[）)]/g, "").trim().slice(0, 20);
}

const FUNCTION_SCORE_MAP: [string[], string, number][] = [
  [["腸内", "便通", "整腸", "腸内フローラ", "おなかの調子"], "gut", 20],
  [["美容", "素肌", "肌の", "潤い", "うるおい"], "beauty", 20],
  [["睡眠", "入眠", "眠り", "リラックス"], "rest", 20],
  [["活力", "エネルギー", "スタミナ"], "vitality", 20],
  [["血行", "血流", "末梢", "冷え"], "circulation", 20],
  [["疲労", "だるさ", "疲れ"], "antiFatigue", 20],
  [["集中", "記憶", "勉強"], "concentration", 20],
  [["免疫", "感染", "風邪"], "immunity", 20],
  [["認知機能", "記憶力", "物忘れ"], "cognitive", 20],
  [["関節", "軟骨", "ひざ", "膝"], "joint", 20],
  [["筋肉", "筋力", "サルコペニア"], "muscle", 20],
  [["抗酸化", "酸化ストレス", "活性酸素"], "antioxidant", 20],
  [["体重", "体脂肪", "内臓脂肪", "ウエスト", "肥満"], "antiObesity", 20],
  [["血糖値", "血圧", "中性脂肪", "コレステロール"], "health", 20],
  [["更年期", "ほてり", "のぼせ"], "menopause", 20],
  [["肝機能", "肝臓", "ALT"], "liver", 20],
];

function inferScores(text: string): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const [keywords, field, val] of FUNCTION_SCORE_MAP) {
    if (keywords.some((kw) => text.includes(kw))) {
      scores[field] = Math.max(scores[field] || 0, val);
    }
  }
  return scores;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuote = !inQuote; }
    } else if (ch === "," && !inQuote) {
      result.push(current); current = "";
    } else { current += ch; }
  }
  result.push(current);
  return result;
}

const csvPath = path.join(root, "beauty_health_project", "機能性表示食品_検索結果一覧.csv");
const outPath = path.join(root, "beauty_health_project", "health_ingredients_aggregated.json");

console.log("読み込み中:", csvPath);
const text = fs.readFileSync(csvPath, "utf-8").replace(/^﻿/, "");
const lines = text.split("\n").filter(Boolean);
const headers = parseCsvLine(lines[0]).map((h) => h.replace(/"/g, "").trim());
console.log(`総行数: ${lines.length - 1}`);

const map = new Map<string, { texts: string[]; count: number }>();
for (const line of lines.slice(1)) {
  if (!line.trim()) continue;
  const cols = parseCsvLine(line);
  const row: Record<string, string> = {};
  headers.forEach((h, i) => { row[h] = cols[i] ?? ""; });
  const rawNames = row["機能性関与成分名"] || "";
  const functionality = row["表示しようとする機能性"] || "";
  if (!rawNames) continue;
  for (const name of rawNames.split(/[\/・、，\n]/).map((s) => s.trim()).filter(Boolean)) {
    if (!map.has(name)) map.set(name, { texts: [], count: 0 });
    const entry = map.get(name)!;
    if (functionality) entry.texts.push(functionality);
    entry.count++;
  }
}

const entries = [...map.entries()].map(([name, { texts, count }]) => {
  const funcText = [...new Set(texts)].slice(0, 3).join(" ");
  return {
    name,
    baseIngredient: inferBaseIngredient(name),
    usageCount: count,
    short: funcText.slice(0, 100) || null,
    ...inferScores(funcText),
  };
});

console.log(`ユニーク成分数: ${entries.length}`);
fs.writeFileSync(outPath, JSON.stringify(entries, null, 0), "utf-8");
const size = (fs.statSync(outPath).size / 1024).toFixed(1);
console.log(`出力完了: ${outPath} (${size} KB)`);
