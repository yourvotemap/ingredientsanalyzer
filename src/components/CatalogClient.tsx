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
};

type Ingredient = {
  id: string;
  name: string;
  inci: string | null;
  aliases: string | null;
  domain: string;
  tags: string | null;
  short: string | null;
  role: string | null;
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

  const cosmeticLabels = { moisture: "保湿", barrier: "バリア", brightening: "透明感", firmness: "ハリ", soothing: "整肌" };
  const healthLabels = { beauty: "美容", rest: "休息", gut: "腸活", vitality: "活力", circulation: "巡り" };
  const labels = selectedProduct?.domain === "healthfood" ? healthLabels : cosmeticLabels;

  // Calculate total scores
  const totalScores: Record<string, number> = {};
  for (const key of Object.keys(labels)) {
    totalScores[key] = analyzedIngredients
      .filter((a) => a.matched)
      .reduce((sum, a) => sum + ((a.matched?.[key as keyof Ingredient] as number) || 0), 0);
  }
  const maxTotal = Math.max(...Object.values(totalScores), 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 製品一覧 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex gap-2 mb-4">
          {["", "cosmetics", "healthfood"].map((d) => (
            <button
              key={d}
              onClick={() => setDomainFilter(d)}
              className={`text-xs px-3 py-1 rounded-full ${
                domainFilter === d
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {d === "" ? "すべて" : d === "cosmetics" ? "化粧品" : "健康食品"}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {filtered.map((product) => (
            <button
              key={product.id}
              onClick={() => setSelectedProduct(product)}
              className={`w-full text-left p-3 rounded-lg transition ${
                selectedProduct?.id === product.id
                  ? "bg-blue-50 border-blue-200 border"
                  : "hover:bg-gray-50 border border-transparent"
              }`}
            >
              <div className="font-medium text-sm">{product.name}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {product.brand} / {product.subcategory}
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">
              製品が登録されていません
            </p>
          )}
        </div>
      </div>

      {/* 分析結果 */}
      <div className="lg:col-span-2">
        {selectedProduct ? (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-bold mb-1">{selectedProduct.name}</h2>
              <p className="text-sm text-gray-500 mb-4">{selectedProduct.adText}</p>

              {/* スコアチャート */}
              <div className="grid grid-cols-5 gap-3 mb-6">
                {Object.entries(labels).map(([key, label]) => (
                  <div key={key} className="text-center">
                    <div className="text-xs text-gray-500 mb-1">{label}</div>
                    <div className="relative h-24 w-full bg-gray-100 rounded-lg overflow-hidden">
                      <div
                        className="absolute bottom-0 w-full bg-blue-500 rounded-b-lg transition-all"
                        style={{
                          height: `${(totalScores[key] / maxTotal) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="text-xs font-medium mt-1">{totalScores[key]}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 成分リスト */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold mb-3">
                全成分分析 ({analyzedIngredients.length}成分)
              </h3>
              <div className="space-y-2">
                {analyzedIngredients.map((item, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      item.matched
                        ? "bg-green-50 border border-green-100"
                        : "bg-red-50 border border-red-100"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-6">{i + 1}</span>
                      <div>
                        <span className="font-medium text-sm">{item.name}</span>
                        {item.matched && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            {item.matched.tags?.split("、").slice(0, 3).join(", ")}
                          </div>
                        )}
                      </div>
                    </div>
                    {item.matched ? (
                      <span className="text-xs text-green-600">
                        {item.matched.role || "DB一致"}
                      </span>
                    ) : (
                      <span className="text-xs text-red-500">未登録</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-400">
            左の製品一覧から分析する製品を選択してください
          </div>
        )}
      </div>
    </div>
  );
}
