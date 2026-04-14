import { prisma } from "@/lib/prisma";
import Link from "next/link";
import IngredientSearch from "@/components/IngredientSearch";

export default async function IngredientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; domain?: string; tag?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = params.q || "";
  const domain = params.domain || "";
  const tag = params.tag || "";
  const page = parseInt(params.page || "1");
  const perPage = 50;

  const where = {
    ...(q && {
      OR: [
        { name: { contains: q } },
        { inci: { contains: q } },
        { english: { contains: q } },
        { aliases: { contains: q } },
      ],
    }),
    ...(domain && { domain }),
    ...(tag && { tags: { contains: tag } }),
  };

  const [ingredients, total] = await Promise.all([
    prisma.ingredient.findMany({
      where,
      skip: (page - 1) * perPage,
      take: perPage,
      orderBy: { name: "asc" },
    }),
    prisma.ingredient.count({ where }),
  ]);

  const totalPages = Math.ceil(total / perPage);

  const allTags = await prisma.ingredient.findMany({
    where: { tags: { not: null } },
    select: { tags: true },
    distinct: ["tags"],
  });
  const uniqueTags = [
    ...new Set(
      allTags
        .flatMap((i) => i.tags?.split("、") || [])
        .filter(Boolean)
        .map((t) => t.trim())
    ),
  ].sort();

  const scoreLabels: Record<string, string> = {
    moisture: "保湿", barrier: "バリア", brightening: "透明感", firmness: "ハリ", soothing: "鎮静",
    beauty: "美容", rest: "休息", gut: "腸活", vitality: "活力", circulation: "血行",
    antiWrinkle: "抗シワ", antiAcne: "抗ニキビ", antiInflammation: "抗炎症", astringent: "収れん",
    turnover: "ターンオーバー", antiSpots: "抗シミ", deodorant: "消臭", antiAging: "アンチエイジング",
    health: "健康", antiFatigue: "抗疲労", concentration: "集中力", immunity: "免疫",
    antiObesity: "抗肥満", cognitive: "認知機能", joint: "関節", muscle: "筋肉",
    menopause: "更年期", menstrual: "月経", fertility: "妊活", maleHealth: "男性力",
    liver: "肝機能", antioxidant: "抗酸化", skinIrritation: "肌刺激性", hairGrowth: "育毛",
    antibacterial: "抗菌",
  };

  return (
    <div>
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">成分データベース</h2>
          <span className="text-sm" style={{ color: "var(--muted)" }}>{total.toLocaleString()} 件</span>
        </div>

        <IngredientSearch
          currentQuery={q}
          currentDomain={domain}
          currentTag={tag}
          tags={uniqueTags}
        />
      </div>

      <div className="card">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 14, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--line)" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 700, color: "var(--muted)", fontSize: 13 }}>名称</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 700, color: "var(--muted)", fontSize: 13 }}>INCI</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 700, color: "var(--muted)", fontSize: 13 }}>区分</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 700, color: "var(--muted)", fontSize: 13 }}>タグ</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 700, color: "var(--muted)", fontSize: 13 }}>役割</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 700, color: "var(--muted)", fontSize: 13 }}>スコア</th>
              </tr>
            </thead>
            <tbody>
              {ingredients.map((ing) => {
                const scores = Object.entries(scoreLabels)
                  .map(([key, label]) => ({
                    label,
                    value: ing[key as keyof typeof ing] as number,
                  }))
                  .filter((s) => s.value > 0)
                  .sort((a, b) => b.value - a.value);

                const domainLabel = ing.domain === "cosmetics" ? "化粧品"
                  : ing.domain === "healthfood" ? "健康食品"
                  : ing.domain === "quasidrug" ? "医薬部外品"
                  : ing.domain;

                return (
                  <tr key={ing.id} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <Link
                        href={`/ingredients/${ing.id}`}
                        className="font-bold hover:underline"
                        style={{ color: "var(--primary)" }}
                      >
                        {ing.name}
                      </Link>
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--muted)", fontSize: 12 }}>
                      {ing.inci || "-"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span className={`tag ${ing.domain === "cosmetics" ? "" : ing.domain === "healthfood" ? "good" : ""}`}>
                        {domainLabel}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div className="flex gap-1 flex-wrap">
                        {ing.tags
                          ?.split("、")
                          .slice(0, 3)
                          .map((t) => (
                            <span key={t} className="tag" style={{ margin: 0 }}>
                              {t.trim()}
                            </span>
                          ))}
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--muted)" }}>
                      {ing.role || "-"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div className="flex gap-1 flex-wrap">
                        {scores.slice(0, 3).map((s) => (
                          <span
                            key={s.label}
                            className="tag good"
                            style={{ margin: 0 }}
                          >
                            {s.label}:{s.value}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
            const p = i + 1;
            return (
              <Link
                key={p}
                href={`/ingredients?q=${q}&domain=${domain}&tag=${tag}&page=${p}`}
                className={`btn ${p === page ? "active" : ""}`}
                style={{ padding: "8px 14px", minHeight: "36px", fontSize: "13px" }}
              >
                {p}
              </Link>
            );
          })}
          {totalPages > 10 && (
            <span style={{ padding: "8px", color: "var(--muted)" }}>...</span>
          )}
        </div>
      )}
    </div>
  );
}
