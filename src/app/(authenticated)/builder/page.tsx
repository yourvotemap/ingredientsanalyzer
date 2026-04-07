import { prisma } from "@/lib/prisma";
import BuilderClient from "@/components/BuilderClient";

export default async function BuilderPage() {
  const ingredients = await prisma.ingredient.findMany({
    where: {
      OR: [
        { role: "主役" },
        { moisture: { gt: 10 } },
        { barrier: { gt: 10 } },
        { brightening: { gt: 10 } },
        { firmness: { gt: 10 } },
        { soothing: { gt: 10 } },
        { beauty: { gt: 10 } },
        { rest: { gt: 10 } },
        { gut: { gt: 10 } },
        { vitality: { gt: 10 } },
        { circulation: { gt: 10 } },
      ],
    },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        ビルダー - 理想処方設計
      </h1>
      <BuilderClient ingredients={ingredients} />
    </div>
  );
}
