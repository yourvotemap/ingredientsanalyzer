"use client";

import { useState } from "react";
import Link from "next/link";

type Ingredient = Record<string, unknown> & {
  id: string;
  name: string;
  domain: string;
  tags: string | null;
  role: string | null;
  short: string | null;
};

const axes = [
  { key: "moisture", label: "保湿" },
  { key: "barrier", label: "バリア" },
  { key: "brightening", label: "透明感" },
  { key: "firmness", label: "ハリ" },
  { key: "soothing", label: "鎮静" },
  { key: "beauty", label: "美容" },
  { key: "rest", label: "休息" },
  { key: "gut", label: "腸活" },
  { key: "vitality", label: "活力" },
  { key: "circulation", label: "血行" },
  { key: "antiWrinkle", label: "抗シワ" },
  { key: "antiAcne", label: "抗ニキビ" },
  { key: "antiInflammation", label: "抗炎症" },
  { key: "astringent", label: "収れん" },
  { key: "turnover", label: "ターンオーバー" },
  { key: "antiSpots", label: "抗シミ" },
  { key: "deodorant", label: "消臭" },
  { key: "antiAging", label: "アンチエイジング" },
  { key: "health", label: "健康" },
  { key: "antiFatigue", label: "抗疲労" },
  { key: "concentration", label: "集中力" },
  { key: "immunity", label: "免疫" },
  { key: "antiObesity", label: "抗肥満" },
  { key: "cognitive", label: "認知機能" },
  { key: "joint", label: "関節" },
  { key: "muscle", label: "筋肉" },
  { key: "menopause", label: "更年期" },
  { key: "menstrual", label: "月経" },
  { key: "fertility", label: "妊活" },
  { key: "maleHealth", label: "男性力" },
  { key: "liver", label: "肝機能" },
  { key: "antioxidant", label: "抗酸化" },
  { key: "skinIrritation", label: "肌刺激性" },
  { key: "hairGrowth", label: "育毛" },
  { key: "antibacterial", label: "抗菌" },
];

export default function RankingClient({
  ingredients,
}: {
  ingredients: Ingredient[];
}) {
  const [sortKey, setSortKey] = useState("moisture");
  const [domainFilter, setDomainFilter] = useState("");

  const filtered = domainFilter
    ? ingredients.filter((i) => i.domain === domainFilter)
    : ingredients;

  const sorted = [...filtered]
    .sort(
      (a, b) =>
        ((b[sortKey] as number) || 0) - ((a[sortKey] as number) || 0)
    )
    .filter((i) => ((i[sortKey] as number) || 0) > 0);

  return (
    <div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="flex gap-4 items-center flex-wrap">
          <div className="flex gap-2">
            {[
              { key: "", label: "すべて" },
              { key: "cosmetics", label: "化粧品" },
              { key: "healthfood", label: "健康食品" },
              { key: "quasidrug", label: "医薬部外品" },
            ].map((d) => (
              <button
                key={d.key}
                onClick={() => setDomainFilter(d.key)}
                className={`text-sm px-4 py-1.5 rounded-full ${
                  domainFilter === d.key
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap mt-3">
          {axes.map((axis) => (
            <button
              key={axis.key}
              onClick={() => setSortKey(axis.key)}
              className={`text-xs px-3 py-1.5 rounded-lg ${
                sortKey === axis.key
                  ? "bg-blue-100 text-blue-700 font-medium"
                  : "bg-gray-50 text-gray-500 hover:bg-gray-100"
              }`}
            >
              {axis.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="divide-y divide-gray-100">
          {sorted.slice(0, 50).map((ing, i) => {
            const value = (ing[sortKey] as number) || 0;
            return (
              <div
                key={ing.id}
                className="flex items-center gap-4 p-4 hover:bg-gray-50 transition"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    i < 3
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/ingredients/${ing.id}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {ing.name}
                  </Link>
                  {ing.short && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {ing.short}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 w-48">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${(value / 10) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-700 w-8 text-right">
                    {value}
                  </span>
                </div>
                <div className="flex gap-1">
                  {ing.tags
                    ?.split("、")
                    .slice(0, 2)
                    .map((t) => (
                      <span
                        key={t}
                        className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded"
                      >
                        {t.trim()}
                      </span>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
