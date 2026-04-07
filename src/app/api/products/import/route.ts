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

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "xlsx" && ext !== "xls") {
      return NextResponse.json(
        { error: ".xlsx/.xls ファイルのみ対応" },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "ファイルサイズが10MBを超えています" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer);
    const ws = wb.Sheets["products"] || wb.Sheets[wb.SheetNames[0]];

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
        await prisma.product.create({
          data: {
            domain: String(row["domain"] || "cosmetics"),
            subcategory: row["subcategory"] ? String(row["subcategory"]) : null,
            name,
            brand: row["brand"] ? String(row["brand"]) : null,
            ingredientsText: row["ingredients"] ? String(row["ingredients"]) : null,
            adText: row["adText"] ? String(row["adText"]) : null,
            adUrl: row["adUrl"] ? String(row["adUrl"]) : null,
          },
        });
        succeeded++;
      } catch {
        failed++;
      }
    }

    await prisma.importLog.create({
      data: {
        fileName: file.name,
        fileType: "products",
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
