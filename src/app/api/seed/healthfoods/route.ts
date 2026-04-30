/**
 * 機能性表示食品データ投入API（バッチ処理版）
 * CSV全行を集計してユニーク成分リストを作成し、
 * offset から batchSize 件だけDBに書き込む。
 *
 * POST body: { offset: number, batchSize: number }
 * Response:  { total, offset, nextOffset, done, created, updated }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const CSV_URL =
  "https://raw.githubusercontent.com/yourvotemap/ingredientsanalyzer/main/beauty_health_project/%E6%A9%9F%E8%83%BD%E6%80%A7%E8%A1%A8%E7%A4%BA%E9%A3%9F%E5%93%81_%E6%A4%9C%E7%B4%A2%E7%B5%90%E6%9E%9C%E4%B8%80%E8%A6%A7.csv";

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
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// CSV を集計してユニーク成分エントリの配列を返す
async function buildIngredientEntries(): Promise<
  Array<{ name: string; funcText: string; count: number }>
> {
  const res = await fetch(CSV_URL, { next: { revalidate: 3600 } } as RequestInit);
  if (!res.ok) throw new Error(`CSV取得失敗: ${res.status}`);
  const text = await res.text();
  const lines = text.replace(/^﻿/, "").split("\n").filter(Boolean);
  const headers = parseCsvLine(lines[0]).map((h) => h.replace(/"/g, "").trim());

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

  return [...map.entries()].map(([name, { texts, count }]) => ({
    name,
    funcText: texts.join(" "),
    count,
  }));
}

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session || (session.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const offset: number = Number(body.offset ?? 0);
  const batchSize: number = Number(body.batchSize ?? 500);

  try {
    const entries = await buildIngredientEntries();
    const total = entries.length;
    const batch = entries.slice(offset, offset + batchSize);

    const existing = await prisma.ingredient.findMany({
      where: { domain: { in: ["healthfood", "both"] } },
      select: { id: true, name: true },
    });
    const byName = new Map<string, string>(existing.map((e) => [e.name, e.id]));

    let created = 0, updated = 0;
    const ops = [];

    for (const { name, funcText, count } of batch) {
      const dbData = {
        domain: "healthfood",
        name,
        baseIngredient: inferBaseIngredient(name),
        usageCount: count,
        short: funcText.slice(0, 100) || null,
        ...inferScores(funcText),
      };

      const existingId = byName.get(name) ?? null;
      if (existingId) {
        ops.push(prisma.ingredient.update({ where: { id: existingId }, data: dbData }));
        updated++;
      } else {
        ops.push(prisma.ingredient.create({ data: dbData }));
        created++;
      }
    }

    if (ops.length > 0) await prisma.$transaction(ops);

    const nextOffset = offset + batchSize;
    const done = nextOffset >= total;

    if (done) {
      await prisma.importLog.create({
        data: {
          fileName: "機能性表示食品_検索結果一覧.csv (GitHub / batch)",
          fileType: "ingredients",
          status: "success",
          rowsProcessed: total,
          rowsSucceeded: total,
          rowsFailed: 0,
          importedBy: session.user?.email || "",
        },
      });
    }

    return NextResponse.json({ total, offset, nextOffset, done, created, updated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
