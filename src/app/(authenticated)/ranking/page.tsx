import { prisma } from "@/lib/prisma";
import RankingClient from "@/components/RankingClient";

export default async function RankingPage() {
  const ingredients = await prisma.ingredient.findMany({
    where: {
      OR: [
        { moisture: { gt: 0 } },
        { barrier: { gt: 0 } },
        { brightening: { gt: 0 } },
        { firmness: { gt: 0 } },
        { soothing: { gt: 0 } },
        { beauty: { gt: 0 } },
        { rest: { gt: 0 } },
        { gut: { gt: 0 } },
        { vitality: { gt: 0 } },
        { circulation: { gt: 0 } },
      ],
    },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        成分ランキング
      </h1>
      <RankingClient ingredients={ingredients} />
    </div>
  );
}
