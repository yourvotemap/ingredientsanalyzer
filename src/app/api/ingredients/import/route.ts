Bash
cat /home/user/ingredientsanalyzer/src/app/api/ingredients/import/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
表示を減らす
import * as XLSX from "xlsx";
// 日本語ヘッダー → 英語フィールドマッピング
const HEADER_MAP: Record<string, string> = {
  "成分名（日本語）": "name",
  "INCI": "inci",
  "英語名": "english",
  "中国語名": "nameZh",
  "別名": "aliases",
  "区分": "domain",
  "役割": "role",
  "高スコアタグ": "tags",
  "保湿": "moisture",
  "バリア": "barrier",
  "透明感": "brightening",
  "ハリ": "firmness",
  "鎮静": "soothing",
  "美容": "beauty",
  "休息": "rest",
  "腸活": "gut",
  "活力": "vitality",
  "血行": "circulation",
  "抗シワ": "antiWrinkle",
  "抗ニキビ": "antiAcne",
  "抗炎症": "antiInflammation",
  "収れん": "astringent",
  "ターンオーバー": "turnover",
  "抗シミ": "antiSpots",
  "消臭": "deodorant",
  "アンチエイジング": "antiAging",
  "健康": "health",
  "抗疲労": "antiFatigue",
  "集中力": "concentration",
  "免疫": "immunity",
  "抗肥満": "antiObesity",
  "認知機能": "cognitive",
  "関節": "joint",
  "筋肉": "muscle",
  "更年期サポート": "menopause",
  "月経サポート": "menstrual",
  "妊活": "fertility",
  "男性力": "maleHealth",
  "肝機能サポート": "liver",
  "抗酸化": "antioxidant",
  "肌刺激性": "skinIrritation",
  "育毛": "hairGrowth",
  "抗菌": "antibacterial",
  "詳細": "detail",
  "英語版詳細": "detailEn",
  "中国語版詳細": "detailZh",
  "注記": "notes",
  "Source URL(s)": "sourceUrl",
};
// 区分 → domain マッピング
const DOMAIN_MAP: Record<string, string> = {
  "化粧品成分": "cosmetics",
  "健康食品成分": "healthfood",
  "医薬部外品成分": "quasidrug",
  cosmetics: "cosmetics",
  healthfood: "healthfood",
};
// 全スコアフィールド名
const SCORE_FIELDS = [
  "moisture", "barrier", "brightening", "firmness", "soothing",
  "beauty", "rest", "gut", "vitality", "circulation",
  "antiWrinkle", "antiAcne", "antiInflammation", "astringent", "turnover",
  "antiSpots", "deodorant", "antiAging", "health", "antiFatigue",
  "concentration", "immunity", "antiObesity", "cognitive", "joint",
  "muscle", "menopause", "menstrual", "fertility", "maleHealth",
  "liver", "antioxidant", "skinIrritation", "hairGrowth", "antibacterial",
];
function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const mapped = HEADER_MAP[key.trim()] || key;
    normalized[mapped] = value;
  }
  return normalized;
}
function detectHeaderRow(ws: XLSX.WorkSheet): number {
  const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
  for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
    const firstCell = String(rawRows[i]?.[0] || "").trim();
    if (firstCell === "成分名（日本語）" || firstCell === "name" || firstCell === "domain") {
      return i;
    }
  }
  return 0;
}
function hasJapaneseHeaders(row: Record<string, unknown>): boolean {
  return Object.keys(row).some((key) => HEADER_MAP[key.trim()] !== undefined);
}
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
    const ws = wb.Sheets["ingredients"] || wb.Sheets["Ingredients"] || wb.Sheets[wb.SheetNames[0]];
    if (!ws) {
      return NextResponse.json(
        { error: "有効なシートが見つかりません" },
        { status: 400 }
      );
    }
    // ヘッダー行を自動検出
    const headerRow = detectHeaderRow(ws);
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { range: headerRow });
    let succeeded = 0;
    let failed = 0;
    // 最初の行で日本語ヘッダーか判定
    const useJapanese = rows.length > 0 && hasJapaneseHeaders(rows[0]);
    for (const rawRow of rows) {
      const row = useJapanese ? normalizeRow(rawRow) : rawRow;
      const name = String(row["name"] || "").trim();
      if (!name) {
        failed++;
        continue;
      }
      try {
        const existing = await prisma.ingredient.findFirst({
          where: { name },
        });
        const domainRaw = String(row["domain"] || "cosmetics").trim();
        const domain = DOMAIN_MAP[domainRaw] || domainRaw;
        // スコアフィールドを動的に構築
        const scores: Record<string, number> = {};
        for (const field of SCORE_FIELDS) {
          scores[field] = Number(row[field]) || 0;
        }
        const data = {
          domain,
          name,
          inci: row["inci"] ? String(row["inci"]) : null,
          english: row["english"] ? String(row["english"]) : null,
          nameEn: row["name_en"] ? String(row["name_en"]) : (row["nameEn"] ? String(row["nameEn"]) : null),
          nameZh: row["name_zh"] ? String(row["name_zh"]) : (row["nameZh"] ? String(row["nameZh"]) : null),
          aliases: row["aliases"] ? String(row["aliases"]) : null,
          tags: row["tags"] ? String(row["tags"]) : null,
          role: row["role"] ? String(row["role"]) : null,
          short: row["short"] ? String(row["short"]) : null,
          detail: row["detail"] ? String(row["detail"]) : null,
          detailEn: row["detailEn"] ? String(row["detailEn"]) : null,
          detailZh: row["detailZh"] ? String(row["detailZh"]) : null,
          merits: row["merits"] ? String(row["merits"]) : null,
          cautions: row["cautions"] ? String(row["cautions"]) : null,
          notes: row["notes"] ? String(row["notes"]) : null,
          sourceUrl: row["sourceUrl"] ? String(row["sourceUrl"]) : null,
          ...scores,
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
