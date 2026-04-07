"use client";

import { useState, useMemo } from "react";

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

const cosmeticAxes = [
  { key: "moisture", label: "保湿" },
  { key: "barrier", label: "バリア" },
  { key: "brightening", label: "透明感" },
  { key: "firmness", label: "ハリ" },
  { key: "soothing", label: "整肌" },
];

const healthAxes = [
  { key: "beauty", label: "美容" },
  { key: "rest", label: "休息" },
  { key: "gut", label: "腸活" },
  { key: "vitality", label: "活力" },
  { key: "circulation", label: "巡り" },
];

export default function BuilderClient({
  ingredients,
}: {
  ingredients: Ingredient[];
}) {
  const [domain, setDomain] = useState("cosmetics");
  const [selected, setSelected] = useState<string[]>([]);
  const [weights, setWeights] = useState<Record<string, number>>({
    moisture: 50,
    barrier: 50,
    brightening: 50,
    firmness: 50,
    soothing: 50,
    beauty: 50,
    rest: 50,
    gut: 50,
    vitality: 50,
    circulation: 50,
  });

  const axes = domain === "cosmetics" ? cosmeticAxes : healthAxes;

  const filteredIngredients = ingredients.filter(
    (i) => i.domain === domain || i.domain === "both"
  );

  // Score and recommend ingredients
  const recommended = useMemo(() => {
    return filteredIngredients
      .map((ing) => {
        let score = 0;
        for (const axis of axes) {
          const val = ing[axis.key as keyof Ingredient] as number;
          const weight = weights[axis.key] / 100;
          score += val * weight;
        }
        return { ...ing, score };
      })
      .sort((a, b) => b.score - a.score)
      .filter((i) => i.score > 0);
  }, [filteredIngredients, weights, axes]);

  // Group recommended by their strongest axis
  const grouped = useMemo(() => {
    const groups: Record<string, typeof recommended> = {};
    for (const axis of axes) {
      groups[axis.key] = [];
    }
    for (const ing of recommended.slice(0, 30)) {
      if (selected.includes(ing.id)) continue;
      let maxKey = axes[0].key;
      let maxVal = 0;
      for (const axis of axes) {
        const val = ing[axis.key as keyof Ingredient] as number;
        if (val > maxVal) {
          maxVal = val;
          maxKey = axis.key;
        }
      }
      groups[maxKey]?.push(ing);
    }
    return groups;
  }, [recommended, selected, axes]);

  const selectedIngredients = selected
    .map((id) => ingredients.find((i) => i.id === id))
    .filter(Boolean) as Ingredient[];

  // Total scores for selected
  const totalScores: Record<string, number> = {};
  for (const axis of axes) {
    totalScores[axis.key] = selectedIngredients.reduce(
      (sum, i) => sum + (i[axis.key as keyof Ingredient] as number),
      0
    );
  }
  const maxScore = Math.max(...Object.values(totalScores), 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 設定パネル */}
      <div className="space-y-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex gap-2 mb-4">
            {["cosmetics", "healthfood"].map((d) => (
              <button
                key={d}
                onClick={() => {
                  setDomain(d);
                  setSelected([]);
                }}
                className={`text-sm px-4 py-1.5 rounded-full ${
                  domain === d
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {d === "cosmetics" ? "化粧品" : "健康食品"}
              </button>
            ))}
          </div>

          <h3 className="text-sm font-semibold mb-3">重視する機能</h3>
          {axes.map((axis) => (
            <div key={axis.key} className="mb-3">
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>{axis.label}</span>
                <span>{weights[axis.key]}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={weights[axis.key]}
                onChange={(e) =>
                  setWeights((w) => ({
                    ...w,
                    [axis.key]: parseInt(e.target.value),
                  }))
                }
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          ))}
        </div>

        {/* 選択済み成分 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h3 className="text-sm font-semibold mb-3">
            選択済み成分 ({selected.length})
          </h3>
          {selectedIngredients.length > 0 ? (
            <div className="space-y-2">
              {selectedIngredients.map((ing) => (
                <div
                  key={ing.id}
                  className="flex items-center justify-between p-2 bg-blue-50 rounded-lg"
                >
                  <span className="text-sm font-medium">{ing.name}</span>
                  <button
                    onClick={() =>
                      setSelected((s) => s.filter((id) => id !== ing.id))
                    }
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">
              推奨成分から追加してください
            </p>
          )}
        </div>
      </div>

      {/* 推奨成分 */}
      <div className="lg:col-span-2 space-y-4">
        {/* スコアサマリー */}
        {selected.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-sm font-semibold mb-3">処方スコア</h3>
            <div className="grid grid-cols-5 gap-3">
              {axes.map((axis) => (
                <div key={axis.key} className="text-center">
                  <div className="text-xs text-gray-500 mb-1">{axis.label}</div>
                  <div className="relative h-20 w-full bg-gray-100 rounded-lg overflow-hidden">
                    <div
                      className="absolute bottom-0 w-full bg-blue-500 rounded-b-lg"
                      style={{
                        height: `${(totalScores[axis.key] / maxScore) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="text-xs font-medium mt-1">
                    {totalScores[axis.key]}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 機能グループ別推奨 */}
        {axes.map((axis) => {
          const group = grouped[axis.key] || [];
          if (group.length === 0) return null;
          return (
            <div
              key={axis.key}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-4"
            >
              <h3 className="text-sm font-semibold mb-3">{axis.label}推奨成分</h3>
              <div className="flex gap-2 flex-wrap">
                {group.slice(0, 8).map((ing) => (
                  <button
                    key={ing.id}
                    onClick={() => setSelected((s) => [...s, ing.id])}
                    className="px-3 py-2 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg text-sm transition"
                  >
                    <div className="font-medium">{ing.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {axis.label}: {ing[axis.key as keyof Ingredient] as number}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
