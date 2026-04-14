import { prisma } from "@/lib/prisma";
import CatalogClient from "@/components/CatalogClient";

export default async function CatalogPage() {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
  });

  const ingredients = await prisma.ingredient.findMany();

  return (
    <div>
      <CatalogClient products={products} ingredients={ingredients} />
    </div>
  );
}
