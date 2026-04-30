/**
 * 化粧品成分データ投入API（バッチ処理版）
 *
 * POST body: { offset: number, batchSize: number }
 * Response:  { total, nextOffset, done, created, updated, skipped }
 *
 * 高速化ポイント:
 *  - 全CSV読み込みは毎回行うが fs.readFileSync は ~100ms で高速
 *  - DBクエリはバッチ内の名前のみに絞る（全件取得しない）
 *  - 新規は createMany（1 round trip）、更新は Promise.all（並列）
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

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
  const m = raw.trim().match(/^([\d,]+)[\s　]*件/);
  if (m) return parseInt(m[1].replace(/,/g, ""), 10);
  const n = parseInt(raw.replace(/,/g, ""), 10);
  return isNaN(n) ? 0 : n;
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

function readAllLines(): string[] {
  const filePath = path.join(process.cwd(), "beauty_health_project", "cosmetic_ingredients.csv");
  return fs.readFileSync(filePath, "utf-8").replace(/^﻿/, "").split("\n").filter(Boolean);
}

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session || (session.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const offset: number = Number(body.offset ?? 0);
  const batchSize: number = Number(body.batchSize ?? 200);

  try {
    const lines = readAllLines();            // ~100ms
    const headers = parseCsvLine(lines[0]);
    const dataLines = lines.slice(1);
    const total = dataLines.length;

    const batch = dataLines.slice(offset, offset + batchSize);

    // バッチ内の成分データを解析
    type IngredientData = {
      domain: string; name: string; inci: string | null;
      nameEn: string | null; english: string | null; nameZh: string | null;
      detail: string | null; notes: string | null; tags: string | null;
      usageCount: number; [key: string]: unknown;
    };

    const parsed: IngredientData[] = [];
    for (const line of batch) {
      if (!line.trim()) continue;
      const cols = parseCsvLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = cols[i] ?? ""; });
      const name = row.name_jp?.trim() || "";
      const inci = row.name_inci?.trim() || "";
      if (!name && !inci) continue;
      const purpose = row.purpose || "";
      parsed.push({
        domain: "cosmetics",
        name: name || inci,
        inci: inci || null,
        nameEn: inci || null,
        english: inci || null,
        nameZh: row.name_cn?.trim() || null,
        detail: row.definition?.trim() || null,
        notes: row.notes?.trim() || null,
        tags: inferTags(purpose) || null,
        usageCount: parseUsageCount(row.commercial_products || ""),
        ...inferScores(purpose),
      });
    }

    // バッチ内の名前のみDBに問い合わせ（全件取得しない）
    const namesInBatch = [...new Set(parsed.map((p) => p.name))];
    const inciInBatch = [...new Set(parsed.map((p) => p.inci).filter(Boolean) as string[])];

    const existing = await prisma.ingredient.findMany({
      where: {
        domain: { in: ["cosmetics", "both", "quasidrug"] },
        OR: [
          { name: { in: namesInBatch } },
          ...(inciInBatch.length > 0 ? [{ inci: { in: inciInBatch } }] : []),
        ],
      },
      select: { id: true, name: true, inci: true },
    });

    const byName = new Map<string, string>(existing.map((e) => [e.name, e.id]));
    const byInci = new Map<string, string>(
      existing.filter((e) => e.inci).map((e) => [e.inci as string, e.id])
    );

    const toCreate: IngredientData[] = [];
    const toUpdate: { id: string; data: IngredientData }[] = [];

    for (const data of parsed) {
      const existingId = byName.get(data.name) || byInci.get(data.inci ?? "") || null;
      if (existingId) {
        toUpdate.push({ id: existingId, data });
      } else {
        toCreate.push(data);
      }
    }

    // 新規: createMany で1回のround trip
    if (toCreate.length > 0) {
      await prisma.ingredient.createMany({ data: toCreate as never[], skipDuplicates: true });
    }

    // 更新: Promise.all で並列実行
    if (toUpdate.length > 0) {
      await Promise.all(
        toUpdate.map(({ id, data }) => prisma.ingredient.update({ where: { id }, data: data as never }))
      );
    }

    const nextOffset = offset + batchSize;
    const done = nextOffset >= total;

    if (done) {
      await prisma.importLog.create({
        data: {
          fileName: "cosmetic_ingredients.csv (local / batch)",
          fileType: "ingredients",
          status: "success",
          rowsProcessed: total,
          rowsSucceeded: total,
          rowsFailed: 0,
          importedBy: session.user?.email || "",
        },
      });
    }

    return NextResponse.json({
      total,
      offset,
      nextOffset: Math.min(nextOffset, total),
      done,
      created: toCreate.length,
      updated: toUpdate.length,
      skipped: batch.length - parsed.length,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
