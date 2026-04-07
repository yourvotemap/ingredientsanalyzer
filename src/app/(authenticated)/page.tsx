import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function DashboardPage() {
  const [ingredientCount, cosmeticsCount, healthfoodCount, productCount] =
    await Promise.all([
      prisma.ingredient.count(),
      prisma.ingredient.count({ where: { domain: "cosmetics" } }),
      prisma.ingredient.count({ where: { domain: "healthfood" } }),
      prisma.product.count(),
    ]);

  const recentIngredients = await prisma.ingredient.findMany({
    where: { role: "主役" },
    take: 10,
    orderBy: { updatedAt: "desc" },
  });

  const stats = [
    { label: "総成分数", value: ingredientCount, color: "bg-blue-500" },
    { label: "化粧品成分", value: cosmeticsCount, color: "bg-pink-500" },
    { label: "健康食品成分", value: healthfoodCount, color: "bg-green-500" },
    { label: "登録製品数", value: productCount, color: "bg-purple-500" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">ダッシュボード</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl shadow-sm p-5 border border-gray-100"
          >
            <div className="text-sm text-gray-500">{stat.label}</div>
            <div className="text-3xl font-bold text-gray-900 mt-1">
              {stat.value.toLocaleString()}
            </div>
            <div className={`h-1 ${stat.color} rounded mt-3 opacity-60`} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-lg font-semibold mb-4">主役成分（最新）</h2>
          <div className="space-y-2">
            {recentIngredients.map((ing) => (
              <Link
                key={ing.id}
                href={`/ingredients/${ing.id}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition"
              >
                <div>
                  <span className="font-medium text-gray-900">{ing.name}</span>
                  {ing.inci && (
                    <span className="text-sm text-gray-400 ml-2">
                      {ing.inci}
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  {ing.tags?.split("、").slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-lg font-semibold mb-4">クイックアクション</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/ingredients"
              className="p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition text-center"
            >
              <div className="text-2xl mb-2">🔍</div>
              <div className="text-sm font-medium">成分検索</div>
            </Link>
            <Link
              href="/catalog"
              className="p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition text-center"
            >
              <div className="text-2xl mb-2">📦</div>
              <div className="text-sm font-medium">製品分析</div>
            </Link>
            <Link
              href="/builder"
              className="p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition text-center"
            >
              <div className="text-2xl mb-2">⚙️</div>
              <div className="text-sm font-medium">理想設計</div>
            </Link>
            <Link
              href="/admin"
              className="p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition text-center"
            >
              <div className="text-2xl mb-2">📥</div>
              <div className="text-sm font-medium">データ管理</div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
