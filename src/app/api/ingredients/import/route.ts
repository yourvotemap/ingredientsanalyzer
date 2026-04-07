import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session || (session.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "ファイルが選択されていません" },
        { status: 400 }
      );
    }

    // Validate extension
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "xlsx" && ext !== "xls") {
      return NextResponse.json(
        { error: ".xlsx/.xls ファイルのみ対応" },
        { status: 400 }
      );
    }

    // Validate size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "ファイルサイズが10MBを超えています" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer);
    const ws = wb.Sheets["ingredients"] || wb.Sheets[wb.SheetNames[0]];

    if (!ws) {
      return NextResponse.json(
        { error: "有効なシートが見つかりません" },
        { status: 400 }
      );
    }

    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws);
    let succeeded = 0;
    let failed = 0;

    for (const row of rows) {
      const name = String(row["name"] || "").trim();
      if (!name) {
        failed++;
        continue;
      }

      try {
        // Upsert by name
        const existing = await prisma.ingredient.findFirst({
          where: { name },
        });

        const data = {
          domain: String(row["domain"] || "cosmetics"),
          name,
          inci: row["inci"] ? String(row["inci"]) : null,
          english: row["english"] ? String(row["english"]) : null,
          nameEn: row["name_en"] ? String(row["name_en"]) : null,
          nameZh: row["name_zh"] ? String(row["name_zh"]) : null,
          aliases: row["aliases"] ? String(row["aliases"]) : null,
          tags: row["tags"] ? String(row["tags"]) : null,
          role: row["role"] ? String(row["role"]) : null,
          short: row["short"] ? String(row["short"]) : null,
          detail: row["detail"] ? String(row["detail"]) : null,
          merits: row["merits"] ? String(row["merits"]) : null,
          cautions: row["cautions"] ? String(row["cautions"]) : null,
          moisture: Number(row["moisture"]) || 0,
          barrier: Number(row["barrier"]) || 0,
          brightening: Number(row["brightening"]) || 0,
          firmness: Number(row["firmness"]) || 0,
          soothing: Number(row["soothing"]) || 0,
          beauty: Number(row["beauty"]) || 0,
          rest: Number(row["rest"]) || 0,
          gut: Number(row["gut"]) || 0,
          vitality: Number(row["vitality"]) || 0,
          circulation: Number(row["circulation"]) || 0,
        };

        if (existing) {
          await prisma.ingredient.update({
            where: { id: existing.id },
            data,
          });
        } else {
          await prisma.ingredient.create({ data });
        }
        succeeded++;
      } catch {
        failed++;
      }
    }

    // Log import
    await prisma.importLog.create({
      data: {
        fileName: file.name,
        fileType: "ingredients",
        status: failed === 0 ? "success" : failed < rows.length ? "partial" : "error",
        rowsProcessed: rows.length,
        rowsSucceeded: succeeded,
        rowsFailed: failed,
        importedBy: session.user?.email || "",
      },
    });

    return NextResponse.json({
      rowsProcessed: rows.length,
      rowsSucceeded: succeeded,
      rowsFailed: failed,
    });
  } catch (error) {
    return NextResponse.json(
      { error: `インポートエラー: ${error instanceof Error ? error.message : "不明"}` },
      { status: 500 }
    );
  }
}
