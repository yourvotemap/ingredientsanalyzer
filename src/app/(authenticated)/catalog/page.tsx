import { prisma } from "@/lib/prisma";
import CatalogClient from "@/components/CatalogClient";

export default async function CatalogPage() {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
  });

  const ingredients = await prisma.ingredient.findMany({
    select: {
      id: true,
      name: true,
      inci: true,
      aliases: true,
      domain: true,
      tags: true,
      short: true,
      role: true,
      moisture: true,
      barrier: true,
      brightening: true,
      firmness: true,
      soothing: true,
      beauty: true,
      rest: true,
      gut: true,
      vitality: true,
      circulation: true,
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">カタログ - 製品分析</h1>
      <CatalogClient products={products} ingredients={ingredients} />
    </div>
  );
}
