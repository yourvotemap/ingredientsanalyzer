import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";

const allScores = [
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

export default async function IngredientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ingredient = await prisma.ingredient.findUnique({ where: { id } });

  if (!ingredient) notFound();

  const scores = allScores.filter(
    ({ key }) => (ingredient[key as keyof typeof ingredient] as number) > 0
  );

  const domainLabel = ingredient.domain === "cosmetics" ? "化粧品"
    : ingredient.domain === "healthfood" ? "健康食品"
    : ingredient.domain === "quasidrug" ? "医薬部外品"
    : ingredient.domain;

  return (
    <div>
      <Link
        href="/ingredients"
        className="text-sm font-bold hover:underline mb-4 inline-block"
        style={{ color: "var(--primary)" }}
      >
        ← 成分一覧に戻る
      </Link>

      <div className="card">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{ingredient.name}</h1>
            <div className="flex gap-3 mt-2 text-sm" style={{ color: "var(--muted)" }}>
              {ingredient.inci && <span>INCI: {ingredient.inci}</span>}
              {ingredient.english && <span>EN: {ingredient.english}</span>}
            </div>
          </div>
          <div className="flex gap-2">
            <span className={`tag ${ingredient.domain === "healthfood" ? "good" : ""}`}>
              {domainLabel}
            </span>
            {ingredient.role && (
              <span className="tag">{ingredient.role}</span>
            )}
          </div>
        </div>

        {ingredient.tags && (
          <div className="flex gap-2 mt-4 flex-wrap">
            {ingredient.tags.split("、").map((t) => (
              <span key={t} className="tag">{t.trim()}</span>
            ))}
          </div>
        )}
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="card" style={{ marginTop: 0 }}>
          <h2 className="text-lg font-bold mb-4">機能スコア</h2>
          {scores.length > 0 ? (
            <div>
              {scores.map(({ key, label }) => {
                const value = ingredient[key as keyof typeof ingredient] as number;
                return (
                  <div key={key} className="scorebar">
                    <div className="scorebar-head">
                      <span>{label}</span>
                      <span>{value}/10</span>
                    </div>
                    <div className="scorebar-outer">
                      <div
                        className="scorebar-inner"
                        style={{ width: `${(value / 10) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--muted)" }}>スコアデータなし</p>
          )}
        </div>

        <div>
          {ingredient.short && (
            <div className="card" style={{ marginTop: 0 }}>
              <h2 className="text-lg font-bold mb-2">概要</h2>
              <p className="text-sm" style={{ color: "var(--muted)", lineHeight: 1.8 }}>
                {ingredient.short}
              </p>
            </div>
          )}

          {ingredient.detail && (
            <div className="card">
              <h2 className="text-lg font-bold mb-2">詳細</h2>
              <p className="text-sm" style={{ color: "var(--muted)", lineHeight: 1.8 }}>
                {ingredient.detail}
              </p>
            </div>
          )}

          {(ingredient.merits || ingredient.cautions) && (
            <div className="card">
              {ingredient.merits && (
                <div style={{ marginBottom: 16 }}>
                  <h3 className="text-sm font-bold mb-2" style={{ color: "var(--good)" }}>メリット</h3>
                  <div className="flex flex-wrap gap-2">
                    {ingredient.merits.split("、").map((m) => (
                      <span key={m} className="tag good">{m.trim()}</span>
                    ))}
                  </div>
                </div>
              )}
              {ingredient.cautions && (
                <div>
                  <h3 className="text-sm font-bold mb-2" style={{ color: "var(--warn)" }}>注意点</h3>
                  <div className="flex flex-wrap gap-2">
                    {ingredient.cautions.split("、").map((c) => (
                      <span key={c} className="tag" style={{ background: "#fffbeb", color: "#92400e", borderColor: "#fde68a" }}>
                        {c.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {ingredient.aliases && (
        <div className="card">
          <h2 className="text-lg font-bold mb-2">別名・表記ゆれ</h2>
          <div className="flex gap-2 flex-wrap">
            {ingredient.aliases.split("、").map((alias) => (
              <span key={alias} className="tag">{alias.trim()}</span>
            ))}
          </div>
        </div>
      )}

      {(ingredient.nameEn || ingredient.nameZh || ingredient.detailEn || ingredient.detailZh) && (
        <div className="card">
          <h2 className="text-lg font-bold mb-2">多言語情報</h2>
          <div className="grid-2">
            {ingredient.nameEn && (
              <div>
                <span className="text-sm font-bold" style={{ color: "var(--muted)" }}>English:</span>{" "}
                <span className="text-sm font-bold">{ingredient.nameEn}</span>
              </div>
            )}
            {ingredient.nameZh && (
              <div>
                <span className="text-sm font-bold" style={{ color: "var(--muted)" }}>中文:</span>{" "}
                <span className="text-sm font-bold">{ingredient.nameZh}</span>
              </div>
            )}
          </div>
          {ingredient.detailEn && (
            <div className="result" style={{ marginTop: 12 }}>
              <div className="text-xs font-bold mb-1" style={{ color: "var(--muted)" }}>English Detail</div>
              <p className="text-sm" style={{ lineHeight: 1.8 }}>{ingredient.detailEn}</p>
            </div>
          )}
          {ingredient.detailZh && (
            <div className="result" style={{ marginTop: 12 }}>
              <div className="text-xs font-bold mb-1" style={{ color: "var(--muted)" }}>中文详情</div>
              <p className="text-sm" style={{ lineHeight: 1.8 }}>{ingredient.detailZh}</p>
            </div>
          )}
        </div>
      )}

      {(ingredient.notes || ingredient.sourceUrl) && (
        <div className="card">
          {ingredient.notes && (
            <div style={{ marginBottom: ingredient.sourceUrl ? 12 : 0 }}>
              <h3 className="text-sm font-bold mb-1">注記</h3>
              <p className="text-sm" style={{ color: "var(--muted)", lineHeight: 1.8 }}>{ingredient.notes}</p>
            </div>
          )}
          {ingredient.sourceUrl && (
            <div>
              <h3 className="text-sm font-bold mb-1">参考URL</h3>
              <p className="text-sm" style={{ color: "var(--primary)", wordBreak: "break-all" }}>{ingredient.sourceUrl}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
