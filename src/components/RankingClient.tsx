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

  const currentLabel = axes.find((a) => a.key === sortKey)?.label || sortKey;

  return (
    <div>
      <div className="card">
        <h2 className="text-xl font-bold mb-4">成分ランキング</h2>

        <div className="flex gap-2 flex-wrap mb-4">
          {[
            { key: "", label: "すべて" },
            { key: "cosmetics", label: "化粧品" },
            { key: "healthfood", label: "健康食品" },
            { key: "quasidrug", label: "医薬部外品" },
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

        <div className="flex gap-2 flex-wrap">
          {axes.map((axis) => (
            <button
              key={axis.key}
              onClick={() => setSortKey(axis.key)}
              className={`btn ${sortKey === axis.key ? "active" : ""}`}
              style={{ padding: "8px 12px", minHeight: "36px", fontSize: "12px" }}
            >
              {axis.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-bold mb-3">{currentLabel} ランキング Top50</h3>
        <div className="space-y-2">
          {sorted.slice(0, 50).map((ing, i) => {
            const value = (ing[sortKey] as number) || 0;
            return (
              <div
                key={ing.id}
                className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition"
                style={{ border: "1px solid var(--line)" }}
              >
                <div
                  className="flex items-center justify-center font-bold text-sm"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: i < 3 ? "#fef3c7" : "#f3f4f6",
                    color: i < 3 ? "#b45309" : "#6b7280",
                  }}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/ingredients/${ing.id}`}
                    className="font-bold hover:underline"
                    style={{ color: "var(--primary)" }}
                  >
                    {ing.name}
                  </Link>
                  {ing.short && (
                    <p className="text-xs mt-0.5 truncate" style={{ color: "var(--muted)" }}>
                      {ing.short}
                    </p>
                  )}
                </div>
                <div style={{ width: 200 }}>
                  <div className="scorebar" style={{ marginTop: 0 }}>
                    <div className="scorebar-outer">
                      <div
                        className="scorebar-inner"
                        style={{ width: `${(value / 10) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
                <span className="font-bold text-sm" style={{ width: 32, textAlign: "right", color: "var(--primary)" }}>
                  {value}
                </span>
                <div className="flex gap-1">
                  {ing.tags
                    ?.split("、")
                    .slice(0, 2)
                    .map((t) => (
                      <span key={t} className="tag" style={{ margin: 0 }}>
                        {t.trim()}
                      </span>
                    ))}
                </div>
              </div>
            );
          })}
          {sorted.length === 0 && (
            <div className="result text-center text-gray-400">
              該当する成分がありません
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
