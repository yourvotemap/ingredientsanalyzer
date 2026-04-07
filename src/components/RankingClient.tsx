"use client";

import { useState } from "react";
import Link from "next/link";

type Ingredient = {
  id: string;
  name: string;
  domain: string;
  tags: string | null;
  role: string | null;
  short: string | null;
  moisture: number;
  barrier: number;
  brightening: number;
  firmness: number;
  soothing: number;
  beauty: number;
  rest: number;
  gut: number;
  vitality: number;
  circulation: number;
};

const axes = [
  { key: "moisture", label: "保湿", group: "cosmetics" },
  { key: "barrier", label: "バリア", group: "cosmetics" },
  { key: "brightening", label: "透明感", group: "cosmetics" },
  { key: "firmness", label: "ハリ", group: "cosmetics" },
  { key: "soothing", label: "整肌", group: "cosmetics" },
  { key: "beauty", label: "美容", group: "healthfood" },
  { key: "rest", label: "休息", group: "healthfood" },
  { key: "gut", label: "腸活", group: "healthfood" },
  { key: "vitality", label: "活力", group: "healthfood" },
  { key: "circulation", label: "巡り", group: "healthfood" },
];

export default function RankingClient({
  ingredients,
}: {
  ingredients: Ingredient[];
}) {
  const [sortKey, setSortKey] = useState("moisture");
  const [domainFilter, setDomainFilter] = useState("cosmetics");

  const filteredAxes = axes.filter((a) => a.group === domainFilter);

  const sorted = [...ingredients]
    .filter((i) => i.domain === domainFilter || i.domain === "both")
    .sort(
      (a, b) =>
        (b[sortKey as keyof Ingredient] as number) -
        (a[sortKey as keyof Ingredient] as number)
    )
    .filter((i) => (i[sortKey as keyof Ingredient] as number) > 0);

  return (
    <div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="flex gap-4 items-center flex-wrap">
          <div className="flex gap-2">
            {["cosmetics", "healthfood"].map((d) => (
              <button
                key={d}
                onClick={() => {
                  setDomainFilter(d);
                  setSortKey(d === "cosmetics" ? "moisture" : "beauty");
                }}
                className={`text-sm px-4 py-1.5 rounded-full ${
                  domainFilter === d
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {d === "cosmetics" ? "化粧品" : "健康食品"}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            {filteredAxes.map((axis) => (
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
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="divide-y divide-gray-100">
          {sorted.slice(0, 50).map((ing, i) => {
            const value = ing[sortKey as keyof Ingredient] as number;
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
                      style={{ width: `${(value / 40) * 100}%` }}
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
