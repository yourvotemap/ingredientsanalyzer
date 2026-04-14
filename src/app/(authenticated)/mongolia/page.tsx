import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function MongoliaPage() {
  // モンゴル由来成分を含む製品を取得
  const mongoliaProducts = await prisma.product.findMany({
    where: {
      mongoliaIngredients: { not: null },
    },
    orderBy: { createdAt: "desc" },
  });

  // 全成分を取得してモンゴル関連をフィルタ
  const allIngredients = await prisma.ingredient.findMany({
    orderBy: { name: "asc" },
  });

  // タグに「モンゴル」を含む成分
  const mongoliaIngredients = allIngredients.filter(
    (i) => i.tags?.includes("モンゴル") || i.notes?.includes("モンゴル")
  );

  return (
    <div>
      <div className="card">
        <h2 className="text-xl font-bold mb-2">モンゴル産特集</h2>
        <p className="lead text-sm">
          モンゴルの大草原から届く、厳選された天然成分をご紹介。
          過酷な環境で育まれた植物は、驚くべき機能性を秘めています。
        </p>
      </div>

      {/* モンゴル由来成分 */}
      <div className="card">
        <h3 className="text-lg font-bold mb-4">注目のモンゴル産成分</h3>
        {mongoliaIngredients.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mongoliaIngredients.map((ing) => {
              const topScores = [
                { key: "moisture", label: "保湿", value: ing.moisture },
                { key: "barrier", label: "バリア", value: ing.barrier },
                { key: "brightening", label: "透明感", value: ing.brightening },
                { key: "soothing", label: "鎮静", value: ing.soothing },
                { key: "antiAging", label: "アンチエイジング", value: ing.antiAging },
                { key: "antioxidant", label: "抗酸化", value: ing.antioxidant },
                { key: "beauty", label: "美容", value: ing.beauty },
                { key: "vitality", label: "活力", value: ing.vitality },
              ]
                .filter((s) => s.value > 0)
                .sort((a, b) => b.value - a.value)
                .slice(0, 4);

              return (
                <div
                  key={ing.id}
                  className="product-card"
                  style={{ border: "1px solid #f59e0b" }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <Link
                        href={`/ingredients/${ing.id}`}
                        className="font-bold text-lg hover:underline"
                        style={{ color: "var(--mongolia)" }}
                      >
                        {ing.name}
                      </Link>
                      {ing.inci && (
                        <div className="text-xs text-gray-500 mt-1">{ing.inci}</div>
                      )}
                    </div>
                    <span className="product-stamp stamp-mongolia text-xs">
                      モンゴル産
                    </span>
                  </div>

                  {ing.short && (
                    <p className="text-sm mt-2" style={{ color: "var(--muted)", lineHeight: 1.7 }}>
                      {ing.short}
                    </p>
                  )}

                  {topScores.length > 0 && (
                    <div className="mt-3">
                      {topScores.map((s) => (
                        <div key={s.key} className="scorebar">
                          <div className="scorebar-head">
                            <span>{s.label}</span>
                            <span>{s.value}/10</span>
                          </div>
                          <div className="scorebar-outer">
                            <div
                              className="scorebar-inner"
                              style={{
                                width: `${(s.value / 10) * 100}%`,
                                background: "var(--mongolia)",
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {ing.tags && (
                    <div className="flex gap-1 flex-wrap mt-3">
                      {ing.tags.split("、").map((t) => (
                        <span key={t} className="tag mongolia">
                          {t.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="result text-center">
            <p className="text-gray-500">
              モンゴル産成分はまだ登録されていません。
              <br />
              管理画面からExcelインポートで成分データを追加してください。
            </p>
          </div>
        )}
      </div>

      {/* モンゴル製品 */}
      {mongoliaProducts.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-bold mb-4">モンゴル産成分配合製品</h3>
          <div className="space-y-3">
            {mongoliaProducts.map((product) => (
              <div key={product.id} className="product-card">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold">{product.name}</div>
                    <div className="text-sm text-gray-500 mt-1">
                      {product.brand}
                      {product.subcategory && ` / ${product.subcategory}`}
                    </div>
                  </div>
                  {product.storyBadge && (
                    <span className="product-stamp stamp-story text-xs">
                      {product.storyBadge}
                    </span>
                  )}
                </div>
                {product.mongoliaIngredients && (
                  <div className="mt-2">
                    <span className="text-xs font-bold" style={{ color: "var(--mongolia)" }}>
                      モンゴル由来成分:
                    </span>{" "}
                    <span className="text-sm">{product.mongoliaIngredients}</span>
                  </div>
                )}
                {product.storyText && (
                  <div className="story-strip text-sm mt-2">{product.storyText}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
