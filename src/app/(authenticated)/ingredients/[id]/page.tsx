import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";

const allScores = [
  { key: "moisture", label: "保湿", color: "bg-blue-500" },
  { key: "barrier", label: "バリア", color: "bg-teal-500" },
  { key: "brightening", label: "透明感", color: "bg-yellow-500" },
  { key: "firmness", label: "ハリ", color: "bg-orange-500" },
  { key: "soothing", label: "鎮静", color: "bg-green-500" },
  { key: "beauty", label: "美容", color: "bg-pink-500" },
  { key: "rest", label: "休息", color: "bg-indigo-500" },
  { key: "gut", label: "腸活", color: "bg-lime-500" },
  { key: "vitality", label: "活力", color: "bg-red-500" },
  { key: "circulation", label: "血行", color: "bg-purple-500" },
  { key: "antiWrinkle", label: "抗シワ", color: "bg-rose-500" },
  { key: "antiAcne", label: "抗ニキビ", color: "bg-amber-500" },
  { key: "antiInflammation", label: "抗炎症", color: "bg-emerald-500" },
  { key: "astringent", label: "収れん", color: "bg-cyan-500" },
  { key: "turnover", label: "ターンオーバー", color: "bg-sky-500" },
  { key: "antiSpots", label: "抗シミ", color: "bg-fuchsia-500" },
  { key: "deodorant", label: "消臭", color: "bg-slate-500" },
  { key: "antiAging", label: "アンチエイジング", color: "bg-violet-500" },
  { key: "health", label: "健康", color: "bg-green-600" },
  { key: "antiFatigue", label: "抗疲労", color: "bg-blue-600" },
  { key: "concentration", label: "集中力", color: "bg-indigo-600" },
  { key: "immunity", label: "免疫", color: "bg-teal-600" },
  { key: "antiObesity", label: "抗肥満", color: "bg-orange-600" },
  { key: "cognitive", label: "認知機能", color: "bg-purple-600" },
  { key: "joint", label: "関節", color: "bg-yellow-600" },
  { key: "muscle", label: "筋肉", color: "bg-red-600" },
  { key: "menopause", label: "更年期", color: "bg-pink-600" },
  { key: "menstrual", label: "月経", color: "bg-rose-600" },
  { key: "fertility", label: "妊活", color: "bg-amber-600" },
  { key: "maleHealth", label: "男性力", color: "bg-blue-700" },
  { key: "liver", label: "肝機能", color: "bg-emerald-600" },
  { key: "antioxidant", label: "抗酸化", color: "bg-lime-600" },
  { key: "skinIrritation", label: "肌刺激性", color: "bg-red-700" },
  { key: "hairGrowth", label: "育毛", color: "bg-stone-500" },
  { key: "antibacterial", label: "抗菌", color: "bg-cyan-600" },
];

export default async function IngredientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ingredient = await prisma.ingredient.findUnique({ where: { id } });

  if (!ingredient) notFound();

  // スコアが0より大きいものだけ表示
  const scores = allScores.filter(
    ({ key }) => (ingredient[key as keyof typeof ingredient] as number) > 0
  );
  const maxScore = 10;

  return (
    <div>
      <Link
        href="/ingredients"
        className="text-sm text-blue-600 hover:underline mb-4 inline-block"
      >
        ← 成分一覧に戻る
      </Link>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {ingredient.name}
            </h1>
            <div className="flex gap-3 mt-2 text-sm text-gray-500">
              {ingredient.inci && <span>INCI: {ingredient.inci}</span>}
              {ingredient.english && <span>EN: {ingredient.english}</span>}
            </div>
          </div>
          <div className="flex gap-2">
            <span
              className={`text-sm px-3 py-1 rounded-full ${
                ingredient.domain === "cosmetics"
                  ? "bg-pink-50 text-pink-700"
                  : ingredient.domain === "quasidrug"
                  ? "bg-orange-50 text-orange-700"
                  : "bg-green-50 text-green-700"
              }`}
            >
              {ingredient.domain === "cosmetics" ? "化粧品" : ingredient.domain === "healthfood" ? "健康食品" : ingredient.domain === "quasidrug" ? "医薬部外品" : ingredient.domain}
            </span>
            {ingredient.role && (
              <span className="text-sm px-3 py-1 rounded-full bg-blue-50 text-blue-700">
                {ingredient.role}
              </span>
            )}
          </div>
        </div>

        {ingredient.tags && (
          <div className="flex gap-2 mt-4 flex-wrap">
            {ingredient.tags.split("、").map((tag) => (
              <span
                key={tag}
                className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full"
              >
                {tag.trim()}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* スコア */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-4">機能スコア</h2>
          <div className="space-y-3">
            {scores.map(({ key, label, color }) => {
              const value = ingredient[key as keyof typeof ingredient] as number;
              const pct = (value / maxScore) * 100;
              return (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${color} rounded-full transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 説明 */}
        <div className="space-y-6">
          {ingredient.short && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold mb-2">概要</h2>
              <p className="text-gray-700 text-sm leading-relaxed">
                {ingredient.short}
              </p>
            </div>
          )}

          {ingredient.detail && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold mb-2">詳細</h2>
              <p className="text-gray-700 text-sm leading-relaxed">
                {ingredient.detail}
              </p>
            </div>
          )}

          {(ingredient.merits || ingredient.cautions) && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              {ingredient.merits && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-green-700 mb-2">
                    メリット
                  </h3>
                  <ul className="space-y-1">
                    {ingredient.merits.split("、").map((m) => (
                      <li
                        key={m}
                        className="text-sm text-gray-700 flex items-start gap-1"
                      >
                        <span className="text-green-500 mt-0.5">✓</span>
                        {m.trim()}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {ingredient.cautions && (
                <div>
                  <h3 className="text-sm font-semibold text-orange-700 mb-2">
                    注意点
                  </h3>
                  <ul className="space-y-1">
                    {ingredient.cautions.split("、").map((c) => (
                      <li
                        key={c}
                        className="text-sm text-gray-700 flex items-start gap-1"
                      >
                        <span className="text-orange-500 mt-0.5">!</span>
                        {c.trim()}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 別名情報 */}
      {ingredient.aliases && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-6">
          <h2 className="text-lg font-semibold mb-2">別名・表記ゆれ</h2>
          <div className="flex gap-2 flex-wrap">
            {ingredient.aliases.split("、").map((alias) => (
              <span
                key={alias}
                className="text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded border border-gray-200"
              >
                {alias.trim()}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 多言語 */}
      {(ingredient.nameEn || ingredient.nameZh) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-6">
          <h2 className="text-lg font-semibold mb-2">多言語名称</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {ingredient.nameEn && (
              <div>
                <span className="text-gray-500">English:</span>{" "}
                <span className="font-medium">{ingredient.nameEn}</span>
              </div>
            )}
            {ingredient.nameZh && (
              <div>
                <span className="text-gray-500">中文:</span>{" "}
                <span className="font-medium">{ingredient.nameZh}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
