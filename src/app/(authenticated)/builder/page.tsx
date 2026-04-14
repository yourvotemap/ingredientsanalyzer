import { prisma } from "@/lib/prisma";
import BuilderClient from "@/components/BuilderClient";

export default async function BuilderPage() {
  const ingredients = await prisma.ingredient.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <BuilderClient ingredients={ingredients} />
    </div>
  );
}
