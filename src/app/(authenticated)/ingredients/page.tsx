import { prisma } from "@/lib/prisma";
import Link from "next/link";
import IngredientSearch from "@/components/IngredientSearch";

export default async function IngredientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; domain?: string; tag?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = params.q || "";
  const domain = params.domain || "";
  const tag = params.tag || "";
  const page = parseInt(params.page || "1");
  const perPage = 50;

  const where = {
    ...(q && {
      OR: [
        { name: { contains: q } },
        { inci: { contains: q } },
        { english: { contains: q } },
        { aliases: { contains: q } },
      ],
    }),
    ...(domain && { domain }),
    ...(tag && { tags: { contains: tag } }),
  };

  const [ingredients, total] = await Promise.all([
    prisma.ingredient.findMany({
      where,
      skip: (page - 1) * perPage,
      take: perPage,
      orderBy: { name: "asc" },
    }),
    prisma.ingredient.count({ where }),
  ]);

  const totalPages = Math.ceil(total / perPage);

  // Get unique tags for filter
  const allTags = await prisma.ingredient.findMany({
    where: { tags: { not: null } },
    select: { tags: true },
    distinct: ["tags"],
  });
  const uniqueTags = [
    ...new Set(
      allTags
        .flatMap((i) => i.tags?.split("、") || [])
        .filter(Boolean)
        .map((t) => t.trim())
    ),
  ].sort();

  const scoreLabels: Record<string, string> = {
    moisture: "保湿", barrier: "バリア", brightening: "透明感", firmness: "ハリ", soothing: "鎮静",
    beauty: "美容", rest: "休息", gut: "腸活", vitality: "活力", circulation: "血行",
    antiWrinkle: "抗シワ", antiAcne: "抗ニキビ", antiInflammation: "抗炎症", astringent: "収れん",
    turnover: "ターンオーバー", antiSpots: "抗シミ", deodorant: "消臭", antiAging: "アンチエイジング",
    health: "健康", antiFatigue: "抗疲労", concentration: "集中力", immunity: "免疫",
    antiObesity: "抗肥満", cognitive: "認知機能", joint: "関節", muscle: "筋肉",
    menopause: "更年期", menstrual: "月経", fertility: "妊活", maleHealth: "男性力",
    liver: "肝機能", antioxidant: "抗酸化", skinIrritation: "肌刺激性", hairGrowth: "育毛",
    antibacterial: "抗菌",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">成分データベース</h1>
        <span className="text-sm text-gray-500">{total.toLocaleString()} 件</span>
      </div>

      <IngredientSearch
        currentQuery={q}
        currentDomain={domain}
        currentTag={tag}
        tags={uniqueTags}
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">名称</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">INCI</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">区分</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">タグ</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">役割</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">スコア</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ingredients.map((ing) => {
                const scores = Object.entries(scoreLabels)
                  .map(([key, label]) => ({
                    label,
                    value: ing[key as keyof typeof ing] as number,
                  }))
                  .filter((s) => s.value > 0);

                return (
                  <tr key={ing.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <Link
                        href={`/ingredients/${ing.id}`}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {ing.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {ing.inci || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          ing.domain === "cosmetics"
                            ? "bg-pink-50 text-pink-700"
                            : ing.domain === "healthfood"
                            ? "bg-green-50 text-green-700"
                            : "bg-gray-50 text-gray-700"
                        }`}
                      >
                        {ing.domain === "cosmetics"
                          ? "化粧品"
                          : ing.domain === "healthfood"
                          ? "健康食品"
                          : ing.domain === "quasidrug"
                          ? "医薬部外品"
                          : ing.domain}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {ing.tags
                          ?.split("、")
                          .slice(0, 3)
                          .map((t) => (
                            <span
                              key={t}
                              className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded"
                            >
                              {t.trim()}
                            </span>
                          ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {ing.role || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {scores.slice(0, 3).map((s) => (
                          <span
                            key={s.label}
                            className="text-xs bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded"
                          >
                            {s.label}:{s.value}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
            const p = i + 1;
            return (
              <Link
                key={p}
                href={`/ingredients?q=${q}&domain=${domain}&tag=${tag}&page=${p}`}
                className={`px-3 py-1.5 rounded text-sm ${
                  p === page
                    ? "bg-blue-600 text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {p}
              </Link>
            );
          })}
          {totalPages > 10 && (
            <span className="px-3 py-1.5 text-gray-400">...</span>
          )}
        </div>
      )}
    </div>
  );
}
