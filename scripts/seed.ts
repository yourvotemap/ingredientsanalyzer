/**
 * Excel テンプレートからDBに成分データをシードするスクリプト
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import XLSX from "xlsx";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

async function seedIngredients() {
  const filePath = path.join(
    __dirname,
    "../beauty_health_project/ingredients_template_qdlnl_preserve_template.xlsx"
  );

  console.log("Reading Excel file:", filePath);
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets["ingredients"];
  if (!ws) throw new Error("ingredients sheet not found");

  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws);
  console.log(`Found ${rows.length} ingredient rows`);

  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const name = String(row["name"] || "").trim();
    if (!name) { skipped++; continue; }

    try {
      await prisma.ingredient.create({
        data: {
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
        },
      });
      created++;
    } catch {
      skipped++;
    }
  }

  console.log(`Ingredients: ${created} created, ${skipped} skipped`);
}

async function seedProducts() {
  const filePath = path.join(
    __dirname,
    "../beauty_health_project/products_template.xlsx"
  );

  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets["products"];
  if (!ws) return;

  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws);
  console.log(`Found ${rows.length} product rows`);

  for (const row of rows) {
    const name = String(row["name"] || "").trim();
    if (!name) continue;

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
  }

  console.log(`Products: ${rows.length} created`);
}

async function seedOcrCorrections() {
  const filePath = path.join(
    __dirname,
    "../beauty_health_project/ocr_corrections_template.xlsx"
  );

  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets["ocr"];
  if (!ws) return;

  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws);
  console.log(`Found ${rows.length} OCR correction rows`);

  for (const row of rows) {
    const wrong = String(row["wrong"] || "").trim();
    const correct = String(row["correct"] || "").trim();
    if (!wrong || !correct) continue;

    await prisma.ocrCorrection.upsert({
      where: { wrong },
      update: { correct },
      create: { wrong, correct },
    });
  }
}

async function seedAdminUser() {
  const hashedPassword = await bcrypt.hash("admin123", 12);
  await prisma.user.upsert({
    where: { email: "admin@company.co.jp" },
    update: {},
    create: {
      email: "admin@company.co.jp",
      name: "管理者",
      hashedPassword,
      role: "admin",
      department: "開発部",
    },
  });

  const salesPassword = await bcrypt.hash("sales123", 12);
  await prisma.user.upsert({
    where: { email: "sales@company.co.jp" },
    update: {},
    create: {
      email: "sales@company.co.jp",
      name: "営業太郎",
      hashedPassword: salesPassword,
      role: "viewer",
      department: "営業部",
    },
  });

  console.log("Admin and sales users created");
}

async function main() {
  console.log("=== Seeding database ===");
  await seedAdminUser();
  await seedIngredients();
  await seedProducts();
  await seedOcrCorrections();
  console.log("=== Seeding complete ===");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
