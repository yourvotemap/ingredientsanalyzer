import { prisma } from "@/lib/prisma";
import RankingClient from "@/components/RankingClient";

export default async function RankingPage() {
  const ingredients = await prisma.ingredient.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <RankingClient ingredients={ingredients} />
    </div>
  );
}
