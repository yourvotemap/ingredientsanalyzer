/**
 * 化粧品成分データ投入API
 * GitHub上のCSVを取得してDBに一括登録
 * 管理者のみ実行可
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const CSV_URL =
  "https://raw.githubusercontent.com/yourvotemap/ingredientsanalyzer/main/beauty_health_project/cosmetic_ingredients.csv";

// purpose → スコアマッピング
const PURPOSE_SCORE_MAP: Array<{ patterns: RegExp[]; fields: Record<string, number> }> = [
  { patterns: [/保湿|湿潤|moistur|humectant/i], fields: { moisture: 20 } },
  { patterns: [/バリア|皮膜|エモリエント|emollient|閉塞/i], fields: { barrier: 20 } },
  { patterns: [/美白|透明感|brightening|whitening/i], fields: { brightening: 20, antiSpots: 15 } },
  { patterns: [/ハリ|リフト|firmness|lifting/i], fields: { firmness: 20 } },
  { patterns: [/鎮静|抗炎症|soothing|anti.?inflam/i], fields: { soothing: 20, antiInflammation: 20 } },
  { patterns: [/抗シワ|しわ|wrinkle|anti.?aging/i], fields: { antiWrinkle: 20, antiAging: 15 } },
  { patterns: [/抗ニキビ|ニキビ|acne|blemish/i], fields: { antiAcne: 20 } },
  { patterns: [/収れん|astringent/i], fields: { astringent: 20 } },
  { patterns: [/ターンオーバー|turnover|exfoliat/i], fields: { turnover: 20 } },
  { patterns: [/シミ|くすみ|spot|depigment/i], fields: { antiSpots: 20 } },
  { patterns: [/抗酸化|酸化防止|antioxidant/i], fields: { antioxidant: 20 } },
  { patterns: [/消臭|deodorant/i], fields: { deodorant: 20 } },
  { patterns: [/育毛|発毛|hair.?growth/i], fields: { hairGrowth: 20 } },
  { patterns: [/抗菌|殺菌|antibacterial|antimicrobial/i], fields: { antibacterial: 20 } },
  { patterns: [/刺激|irritat/i], fields: { skinIrritation: 20 } },
];

const TAG_MAP: [RegExp, string][] = [
  [/保湿|湿潤|moistur|humectant/i, "保湿"],
  [/バリア|皮膜|エモリエント|emollient|閉塞/i, "バリア"],
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

function inferScores(purpose: string): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const { patterns, fields } of PURPOSE_SCORE_MAP) {
    if (patterns.some((p) => p.test(purpose))) {
      for (const [f, v] of Object.entries(fields)) {
        scores[f] = Math.max(scores[f] || 0, v);
      }
    }
  }
  return scores;
}

function inferTags(purpose: string): string {
  return TAG_MAP.filter(([p]) => p.test(purpose)).map(([, t]) => t).join("、");
}

function parseUsageCount(raw: string): number {
  if (!raw) return 0;
  const kenMatch = raw.trim().match(/^([\d,]+)[\s　]*件/);
  if (kenMatch) return parseInt(kenMatch[1].replace(/,/g, ""), 10);
  const num = parseInt(raw.replace(/,/g, ""), 10);
  return isNaN(num) ? 0 : num;
}

// シンプルなCSVパーサー（引用符・カンマ対応）
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
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session || (session.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  // ストリーミングレスポンスで進捗を返す
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (msg: string) => controller.enqueue(encoder.encode(msg + "\n"));

      try {
        send("📥 GitHubからCSVを取得中...");
        const res = await fetch(CSV_URL);
        if (!res.ok) throw new Error(`CSV取得失敗: ${res.status}`);
        const csvText = await res.text();

        const lines = csvText.replace(/^﻿/, "").split("\n").filter(Boolean);
        const headers = parseCsvLine(lines[0]);
        send(`✅ CSVヘッダー確認: ${headers.slice(0, 5).join(", ")} ...`);
        send(`📊 成分数: ${lines.length - 1}件`);

        // 既存レコードをname/inciで一括取得
        const existing = await prisma.ingredient.findMany({
          where: { domain: { in: ["cosmetics", "both", "quasidrug"] } },
          select: { id: true, name: true, inci: true },
        });
        const byName = new Map<string, string>(existing.map((e) => [e.name, e.id]));
        const byInci = new Map<string, string>(
          existing.filter((e) => e.inci).map((e) => [e.inci as string, e.id])
        );

        let created = 0, updated = 0, skipped = 0;
        const BATCH = 50;
        const dataRows = lines.slice(1);

        for (let i = 0; i < dataRows.length; i += BATCH) {
          const batch = dataRows.slice(i, i + BATCH);
          const ops = [];

          for (const line of batch) {
            if (!line.trim()) continue;
            const cols = parseCsvLine(line);
            const row: Record<string, string> = {};
            headers.forEach((h, idx) => { row[h] = cols[idx] ?? ""; });

            const name = row.name_jp?.trim() || "";
            const inci = row.name_inci?.trim() || "";
            if (!name && !inci) { skipped++; continue; }

            const purpose = row.purpose || "";
            const scores = inferScores(purpose);
            const tags = inferTags(purpose);
            const usageCount = parseUsageCount(row.commercial_products || "");

            const data = {
              domain: "cosmetics",
              name: name || inci,
              inci: inci || null,
              nameEn: inci || null,
              english: inci || null,
              nameZh: row.name_cn?.trim() || null,
              detail: row.definition?.trim() || null,
              notes: row.notes?.trim() || null,
              tags: tags || null,
              usageCount,
              ...scores,
            };

            const existingId = byName.get(name) || byInci.get(inci) || null;
            if (existingId) {
              ops.push(prisma.ingredient.update({ where: { id: existingId }, data }));
              updated++;
            } else {
              ops.push(prisma.ingredient.create({ data }));
              created++;
            }
          }

          if (ops.length > 0) {
            await prisma.$transaction(ops);
          }

          if (i % (BATCH * 10) === 0) {
            send(`  処理済み: ${Math.min(i + BATCH, dataRows.length)} / ${dataRows.length}`);
          }
        }

        await prisma.importLog.create({
          data: {
            fileName: "cosmetic_ingredients.csv (GitHub)",
            fileType: "ingredients",
            status: "success",
            rowsProcessed: dataRows.length,
            rowsSucceeded: created + updated,
            rowsFailed: skipped,
            importedBy: session.user?.email || "",
          },
        });

        send(`\n✅ 完了！`);
        send(`  新規登録: ${created}件`);
        send(`  更新: ${updated}件`);
        send(`  スキップ: ${skipped}件`);
      } catch (e) {
        send(`❌ エラー: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
