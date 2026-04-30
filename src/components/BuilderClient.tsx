"use client";

import { useState, useMemo } from "react";

type Ingredient = Record<string, unknown> & {
  id: string;
  name: string;
  domain: string;
  tags: string | null;
  role: string | null;
  short: string | null;
  usageCount: number;
  baseIngredient: string | null;
};

const cosmeticAxes = [
  { key: "moisture", label: "保湿" },
  { key: "barrier", label: "バリア" },
  { key: "brightening", label: "透明感" },
  { key: "firmness", label: "ハリ" },
  { key: "soothing", label: "鎮静" },
  { key: "antiWrinkle", label: "抗シワ" },
  { key: "antiAcne", label: "抗ニキビ" },
  { key: "antiInflammation", label: "抗炎症" },
  { key: "astringent", label: "収れん" },
  { key: "turnover", label: "ターンオーバー" },
  { key: "antiSpots", label: "抗シミ" },
  { key: "antiAging", label: "アンチエイジング" },
  { key: "antioxidant", label: "抗酸化" },
  { key: "skinIrritation", label: "肌刺激性" },
  { key: "hairGrowth", label: "育毛" },
  { key: "antibacterial", label: "抗菌" },
  { key: "deodorant", label: "消臭" },
];

const healthAxes = [
  { key: "beauty", label: "美容" },
  { key: "rest", label: "休息" },
  { key: "gut", label: "腸活" },
  { key: "vitality", label: "活力" },
  { key: "circulation", label: "血行" },
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
];

export default function BuilderClient({
  ingredients,
}: {
  ingredients: Ingredient[];
}) {
  const [domain, setDomain] = useState("cosmetics");
  const [selected, setSelected] = useState<string[]>([]);
  const [weights, setWeights] = useState<Record<string, number>>(() => {
    const w: Record<string, number> = {};
    [...cosmeticAxes, ...healthAxes].forEach((a) => { w[a.key] = 50; });
    return w;
  });

  const axes = domain === "cosmetics" ? cosmeticAxes : healthAxes;

  const filteredIngredients = ingredients.filter(
    (i) => i.domain === domain || i.domain === "both" || i.domain === "quasidrug"
  );

  const recommended = useMemo(() => {
    return filteredIngredients
      .map((ing) => {
        let score = 0;
        for (const axis of axes) {
          const val = (ing[axis.key] as number) || 0;
          const weight = weights[axis.key] / 100;
          score += val * weight;
        }
        return { ...ing, score } as Ingredient & { score: number };
      })
      // 機能スコアが同じ場合は使用頻度（usageCount）が多い成分を優先
      .sort((a, b) => b.score - a.score || b.usageCount - a.usageCount)
      .filter((i) => i.score > 0);
  }, [filteredIngredients, weights, axes]);

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
        const val = ((ing as Record<string, unknown>)[axis.key] as number) || 0;
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

  const totalScores: Record<string, number> = {};
  for (const axis of axes) {
    totalScores[axis.key] = selectedIngredients.reduce(
      (sum, i) => sum + ((i[axis.key] as number) || 0),
      0
    );
  }
  const maxScore = Math.max(...Object.values(totalScores), 1);

  return (
    <div>
      {/* 肌診断セクション */}
      <div className="card mb-4">
        <h2 className="text-xl font-bold mb-4">肌診断 & 理想設計</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 設定パネル */}
          <div className="space-y-4">
            <div>
              <div className="flex gap-2 mb-4">
                {[
                  { key: "cosmetics", label: "化粧品" },
                  { key: "healthfood", label: "健康食品" },
                ].map((d) => (
                  <button
                    key={d.key}
                    onClick={() => {
                      setDomain(d.key);
                      setSelected([]);
                    }}
                    className={`pill ${domain === d.key ? "active" : ""}`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              <h3 className="text-sm font-bold mb-3">重視する機能</h3>
              {axes.slice(0, 8).map((axis) => (
                <div key={axis.key} className="mb-3">
                  <div className="question-row">
                    <span className="text-sm font-bold">{axis.label}</span>
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
                      className="w-full accent-[#2563eb]"
                    />
                    <span className="range-value">{weights[axis.key]}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* 選択済み成分 */}
            <div className="card" style={{ padding: "12px" }}>
              <h3 className="text-sm font-bold mb-3">
                選択済み成分 ({selected.length})
              </h3>
              {selectedIngredients.length > 0 ? (
                <div className="space-y-2">
                  {selectedIngredients.map((ing) => (
                    <div
                      key={ing.id}
                      className="flex items-center justify-between p-2 rounded-lg"
                      style={{ background: "#eef2ff", border: "1px solid #c7d2fe" }}
                    >
                      <span className="text-sm font-bold">{ing.name}</span>
                      <button
                        onClick={() =>
                          setSelected((s) => s.filter((id) => id !== ing.id))
                        }
                        className="text-xs text-red-600 font-bold hover:text-red-800"
                        style={{ margin: 0, padding: "4px 8px", minHeight: "auto" }}
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

          {/* 推奨成分 & スコア */}
          <div className="lg:col-span-2 space-y-4">
            {/* スコアサマリー */}
            {selected.length > 0 && (
              <div className="card">
                <h3 className="text-sm font-bold mb-3">処方スコア</h3>
                <div className="space-y-2">
                  {axes.map((axis) => {
                    const val = totalScores[axis.key] || 0;
                    return (
                      <div key={axis.key} className="scorebar">
                        <div className="scorebar-head">
                          <span>{axis.label}</span>
                          <span>{val}</span>
                        </div>
                        <div className="scorebar-outer">
                          <div
                            className="scorebar-inner"
                            style={{ width: `${Math.min((val / maxScore) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 機能グループ別推奨 */}
            {axes.map((axis) => {
              const group = grouped[axis.key] || [];
              if (group.length === 0) return null;
              return (
                <div key={axis.key} className="card">
                  <h3 className="text-sm font-bold mb-3">{axis.label}推奨成分</h3>
                  <div className="pill-grid">
                    {group.slice(0, 8).map((ing) => (
                      <button
                        key={ing.id}
                        onClick={() => setSelected((s) => [...s, ing.id])}
                        className="pill"
                        style={{ textAlign: "left" }}
                      >
                        <div className="font-bold">{ing.name}</div>
                        <div className="text-xs" style={{ color: "#6b7280", marginTop: "2px" }}>
                          {axis.label}: {(ing[axis.key] as number) || 0}
                          {ing.baseIngredient && (
                            <span style={{ marginLeft: "6px", color: "#9ca3af" }}>
                              [{ing.baseIngredient}]
                            </span>
                          )}
                          {ing.usageCount > 0 && domain === "cosmetics" && (
                            <span style={{ marginLeft: "6px", color: "#9ca3af" }}>
                              {ing.usageCount}製品
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
