/**
 * 機能性表示食品データ投入API（バッチ処理版）
 * 事前集計済みJSON（health_ingredients_aggregated.json）を読み込み、
 * offset から batchSize 件だけDBに書き込む。
 *
 * POST body: { offset: number, batchSize: number }
 * Response:  { total, offset, nextOffset, done, created, updated }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

type AggregatedEntry = {
  name: string;
  baseIngredient: string;
  usageCount: number;
  short: string | null;
  [key: string]: unknown;
};

function readEntries(): AggregatedEntry[] {
  const filePath = path.join(
    process.cwd(),
    "beauty_health_project",
    "health_ingredients_aggregated.json"
  );
  const text = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(text) as AggregatedEntry[];
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
    const entries = readEntries();
    const total = entries.length;
    const batch = entries.slice(offset, offset + batchSize);

    const namesInBatch = batch.map((e) => e.name);

    const existing = await prisma.ingredient.findMany({
      where: {
        domain: { in: ["healthfood", "both"] },
        name: { in: namesInBatch },
      },
      select: { id: true, name: true },
    });
    const byName = new Map<string, string>(existing.map((e) => [e.name, e.id]));

    const toCreate: AggregatedEntry[] = [];
    const toUpdate: { id: string; data: AggregatedEntry }[] = [];

    for (const entry of batch) {
      const dbData = { domain: "healthfood", ...entry };
      const existingId = byName.get(entry.name) ?? null;
      if (existingId) {
        toUpdate.push({ id: existingId, data: dbData as AggregatedEntry });
      } else {
        toCreate.push(dbData as AggregatedEntry);
      }
    }

    if (toCreate.length > 0) {
      await prisma.ingredient.createMany({ data: toCreate as never[], skipDuplicates: true });
    }

    if (toUpdate.length > 0) {
      await Promise.all(
        toUpdate.map(({ id, data }) =>
          prisma.ingredient.update({ where: { id }, data: data as never })
        )
      );
    }

    const nextOffset = offset + batchSize;
    const done = nextOffset >= total;

    if (done) {
      await prisma.importLog.create({
        data: {
          fileName: "health_ingredients_aggregated.json (batch)",
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
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
