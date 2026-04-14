"use client";

import { useState } from "react";

type Product = {
  id: string;
  name: string;
  domain: string;
  subcategory: string | null;
  brand: string | null;
  ingredientsText: string | null;
  adText: string | null;
  mongoliaIngredients: string | null;
  storyBadge: string | null;
  storyText: string | null;
};

type Ingredient = Record<string, unknown> & {
  id: string;
  name: string;
  inci: string | null;
  aliases: string | null;
  domain: string;
  tags: string | null;
  short: string | null;
  role: string | null;
};

const allScoreKeys = [
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
  { key: "antiSpots", label: "抗シミ" },
  { key: "antiAging", label: "アンチエイジング" },
  { key: "antioxidant", label: "抗酸化" },
  { key: "health", label: "健康" },
  { key: "immunity", label: "免疫" },
];

function matchIngredient(name: string, ingredients: Ingredient[]): Ingredient | null {
  const normalized = name.trim().toLowerCase();
  for (const ing of ingredients) {
    if (ing.name.toLowerCase() === normalized) return ing;
    if (ing.inci?.toLowerCase() === normalized) return ing;
    if (ing.aliases) {
      const aliasList = ing.aliases.split("、").map((a) => a.trim().toLowerCase());
      if (aliasList.includes(normalized)) return ing;
    }
  }
  return null;
}

export default function CatalogClient({
  products,
  ingredients,
}: {
  products: Product[];
  ingredients: Ingredient[];
}) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [domainFilter, setDomainFilter] = useState("");

  const filtered = domainFilter
    ? products.filter((p) => p.domain === domainFilter)
    : products;

  const analyzedIngredients = selectedProduct?.ingredientsText
    ? selectedProduct.ingredientsText.split("、").map((name) => {
        const trimmed = name.trim();
        const matched = matchIngredient(trimmed, ingredients);
        return { name: trimmed, matched };
      })
    : [];

  // Calculate total scores for all axes
  const totalScores: Record<string, number> = {};
  for (const { key } of allScoreKeys) {
    totalScores[key] = analyzedIngredients
      .filter((a) => a.matched)
      .reduce((sum, a) => sum + ((a.matched?.[key] as number) || 0), 0);
  }
  const activeScores = allScoreKeys.filter(({ key }) => totalScores[key] > 0);
  const maxTotal = Math.max(...Object.values(totalScores), 1);

  return (
    <div>
      <div className="card">
        <h2 className="text-xl font-bold mb-4">おすすめ製品カタログ</h2>

        <div className="flex gap-3 mb-4 flex-wrap">
          {[
            { key: "", label: "すべて" },
            { key: "cosmetics", label: "化粧品" },
            { key: "healthfood", label: "健康食品" },
          ].map((d) => (
            <button
              key={d.key}
              onClick={() => setDomainFilter(d.key)}
              className={`pill ${domainFilter === d.key ? "active" : ""}`}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Product list */}
        <div className="space-y-3">
          {filtered.map((product) => (
            <div
              key={product.id}
              onClick={() => setSelectedProduct(product)}
              className={`product-card ${
                selectedProduct?.id === product.id ? "ring-2 ring-blue-500" : ""
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold">{product.name}</div>
                  <div className="text-sm text-gray-500 mt-1">
                    {product.brand} {product.subcategory && `/ ${product.subcategory}`}
                  </div>
                </div>
                <div className="flex gap-2">
                  {product.mongoliaIngredients && (
                    <span className="product-stamp stamp-mongolia text-xs">モンゴル産</span>
                  )}
                  {product.storyBadge && (
                    <span className="product-stamp stamp-story text-xs">{product.storyBadge}</span>
                  )}
                </div>
              </div>
              {product.storyText && (
                <div className="story-strip text-sm mt-2">{product.storyText}</div>
              )}
              <div className="text-xs mt-2" style={{ color: "var(--primary)" }}>
                クリックして成分分析
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="result text-center text-gray-400">
              製品が登録されていません
            </div>
          )}
        </div>
      </div>

      {/* Analysis result */}
      {selectedProduct && (
        <div className="card">
          <h2 className="text-xl font-bold mb-1">{selectedProduct.name}</h2>
          {selectedProduct.adText && (
            <p className="lead text-sm mb-4">{selectedProduct.adText}</p>
          )}

          {/* Score bars */}
          {activeScores.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-bold mb-3">機能スコア分析</h3>
              {activeScores.map(({ key, label }) => (
                <div key={key} className="scorebar">
                  <div className="scorebar-head">
                    <span>{label}</span>
                    <span>{totalScores[key]}</span>
                  </div>
                  <div className="scorebar-outer">
                    <div
                      className="scorebar-inner"
                      style={{ width: `${Math.min((totalScores[key] / maxTotal) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Ingredient list */}
          <h3 className="text-sm font-bold mb-3">
            全成分分析 ({analyzedIngredients.length}成分)
          </h3>
          <div className="space-y-2">
            {analyzedIngredients.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-xl"
                style={{
                  background: item.matched ? "#ecfdf5" : "#fef2f2",
                  border: `1px solid ${item.matched ? "#a7f3d0" : "#fecaca"}`,
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-6 font-bold">{i + 1}</span>
                  <div>
                    <span className="font-bold text-sm">{item.name}</span>
                    {item.matched?.tags && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {(item.matched.tags as string).split("、").slice(0, 3).map((t) => (
                          <span key={t} className="tag good text-xs" style={{ margin: 0, padding: "2px 6px" }}>
                            {t.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {item.matched ? (
                  <span className="tag good">{(item.matched.role as string) || "DB一致"}</span>
                ) : (
                  <span className="text-xs font-bold" style={{ color: "var(--bad)" }}>未登録</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
