"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/* ── Types ── */
type CosmeticItem = {
  id: number;
  jp: string;
  inci: string;
  tags: string[];
  rec: number;
  pop: number;
  def: string;
  sc: [string, number][];
};

type HealthItem = {
  id: string;
  name: string;
  category: string;
  functions: { jp: string[]; en: string[]; cn: string[] };
  product_count: number;
  popularity_score: number;
  recommendation_score: number;
  raw_materials: string;
  products: string[];
};

type Mode = "cosmetics" | "health";

/* ── Score label map ── */
const SCORE_LABELS: Record<string, string> = {
  moisture: "保湿", barrier: "バリア", brightening: "美白",
  acne: "ニキビ", soothing: "鎮静", antioxidant: "抗酸化",
  exfoliant: "角質ケア", uv: "UV", antiaging: "エイジング", hair: "ヘア",
};

/* ── Cosmetics tag pills (most common) ── */
const COSMETIC_TAGS = [
  "保湿","バリア","美白","鎮静","抗酸化","エイジング","ニキビ",
  "エモリエント","UV","角質ケア","ヘア",
];

/* ── Health food function pills ── */
const HEALTH_TAGS = [
  "腸内環境","血糖値","体脂肪","血圧","睡眠","疲労","免疫",
  "骨・関節","肌","認知","目","筋肉",
];

const PAGE_SIZE = 48;

export default function SearchClient() {
  const [mode, setMode] = useState<Mode>("cosmetics");

  /* data */
  const [cosmetics, setCosmetics] = useState<CosmeticItem[]>([]);
  const [healthfoods, setHealthfoods] = useState<HealthItem[]>([]);
  const [loading, setLoading] = useState(false);

  /* filters */
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState("");
  const [sort, setSort] = useState<"rec" | "pop">("rec");
  const [page, setPage] = useState(1);

  /* modal */
  const [modal, setModal] = useState<CosmeticItem | HealthItem | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  /* ── Load data ── */
  useEffect(() => {
    if (mode === "cosmetics" && cosmetics.length === 0) {
      setLoading(true);
      fetch("/data/cosmetics.json")
        .then((r) => r.json())
        .then((d) => setCosmetics(d))
        .finally(() => setLoading(false));
    }
    if (mode === "health" && healthfoods.length === 0) {
      setLoading(true);
      fetch("/data/healthfoods.json")
        .then((r) => r.json())
        .then((d) => setHealthfoods(d))
        .finally(() => setLoading(false));
    }
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  /* reset filters on mode change */
  const switchMode = useCallback((m: Mode) => {
    setMode(m);
    setQuery("");
    setActiveTag("");
    setPage(1);
  }, []);

  /* ── Filter & sort ── */
  const q = query.trim().toLowerCase();

  const filteredCosmetics = cosmetics
    .filter((item) => {
      if (q && !item.jp.toLowerCase().includes(q) && !item.inci.toLowerCase().includes(q)) return false;
      if (activeTag && !item.tags.includes(activeTag)) return false;
      return true;
    })
    .sort((a, b) => (sort === "rec" ? b.rec - a.rec : b.pop - a.pop));

  const filteredHealth = healthfoods
    .filter((item) => {
      if (q && !item.name.toLowerCase().includes(q) &&
          !item.functions.jp.join("").toLowerCase().includes(q)) return false;
      if (activeTag && !item.functions.jp.includes(activeTag)) return false;
      return true;
    })
    .sort((a, b) =>
      sort === "rec"
        ? b.recommendation_score - a.recommendation_score
        : b.popularity_score - a.popularity_score
    );

  const filtered = mode === "cosmetics" ? filteredCosmetics : filteredHealth;
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const currentPage = Math.min(page, totalPages || 1);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleSearch = (v: string) => { setQuery(v); setPage(1); };
  const handleTag = (t: string) => { setActiveTag(t === activeTag ? "" : t); setPage(1); };

  /* ── Render score bar ── */
  const ScoreBar = ({ label, value }: { label: string; value: number }) => (
    <div className="scorebar">
      <div className="scorebar-head">
        <span>{label}</span>
        <span style={{ color: "var(--primary)" }}>{value}</span>
      </div>
      <div className="scorebar-outer">
        <div className="scorebar-inner" style={{ width: `${value * 10}%` }} />
      </div>
    </div>
  );

  /* ── Cosmetic card ── */
  const CosmeticCard = ({ item }: { item: CosmeticItem }) => (
    <div
      className="product-card"
      onClick={() => setModal(item)}
      style={{ cursor: "pointer" }}
    >
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, lineHeight: 1.3 }}>
        {item.jp}
      </div>
      {item.inci && (
        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6, lineHeight: 1.3 }}>
          {item.inci.length > 60 ? item.inci.slice(0, 60) + "…" : item.inci}
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
        {item.tags.slice(0, 4).map((t) => (
          <span key={t} className="tag" style={{ margin: 0, fontSize: 11, padding: "3px 8px" }}>{t}</span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--muted)" }}>
        <span>おすすめ度 <b style={{ color: "var(--primary)" }}>{item.rec}</b></span>
        <span>人気度 <b style={{ color: "var(--primary)" }}>{item.pop}</b></span>
      </div>
      {item.sc.length > 0 && (
        <div style={{ marginTop: 6 }}>
          {item.sc.slice(0, 2).map(([k, v]) => (
            <ScoreBar key={k} label={SCORE_LABELS[k] ?? k} value={v} />
          ))}
        </div>
      )}
      <span className="action-hint" style={{ fontSize: 11, marginTop: 8 }}>詳細 →</span>
    </div>
  );

  /* ── Health card ── */
  const HealthCard = ({ item }: { item: HealthItem }) => (
    <div
      className="product-card"
      onClick={() => setModal(item)}
      style={{ cursor: "pointer" }}
    >
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, lineHeight: 1.3 }}>
        {item.name}
      </div>
      {item.category && (
        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>{item.category}</div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
        {item.functions.jp.slice(0, 4).map((t) => (
          <span key={t} className="tag good" style={{ margin: 0, fontSize: 11, padding: "3px 8px" }}>{t}</span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--muted)" }}>
        <span>製品数 <b style={{ color: "var(--primary)" }}>{item.product_count.toLocaleString()}</b></span>
        <span>人気度 <b style={{ color: "var(--primary)" }}>{item.popularity_score}</b></span>
      </div>
      <div style={{ marginTop: 6 }}>
        <ScoreBar label="おすすめ度" value={Math.round(item.recommendation_score / 10)} />
      </div>
      <span className="action-hint" style={{ fontSize: 11, marginTop: 8 }}>詳細 →</span>
    </div>
  );

  /* ── Modal body ── */
  const ModalBody = () => {
    if (!modal) return null;
    const isCosmetic = "jp" in modal;

    if (isCosmetic) {
      const item = modal as CosmeticItem;
      return (
        <>
          <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>{item.inci}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {item.tags.map((t) => (
              <span key={t} className="tag" style={{ margin: 0 }}>{t}</span>
            ))}
          </div>
          {item.def && (
            <div className="result" style={{ marginBottom: 16 }}>
              <b>成分説明</b>
              <p style={{ margin: "8px 0 0", lineHeight: 1.7, fontSize: 14 }}>{item.def}</p>
            </div>
          )}
          <div className="grid-2">
            <div>
              <b style={{ fontSize: 14 }}>機能スコア</b>
              {item.sc.length > 0
                ? item.sc.map(([k, v]) => (
                    <ScoreBar key={k} label={SCORE_LABELS[k] ?? k} value={v} />
                  ))
                : <p style={{ color: "var(--muted)", fontSize: 13 }}>スコアデータなし</p>}
            </div>
            <div>
              <b style={{ fontSize: 14 }}>評価</b>
              <ScoreBar label="おすすめ度" value={Math.round(item.rec / 10)} />
              <ScoreBar label="人気度" value={Math.round(item.pop / 10)} />
            </div>
          </div>
        </>
      );
    }

    const item = modal as HealthItem;
    return (
      <>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          {item.functions.jp.map((t) => (
            <span key={t} className="tag good" style={{ margin: 0 }}>{t}</span>
          ))}
        </div>
        <div className="grid-2" style={{ marginBottom: 16 }}>
          <div className="result">
            <b>おすすめ度</b>
            <div style={{ fontSize: 32, fontWeight: 900, color: "var(--primary)" }}>
              {item.recommendation_score}
            </div>
          </div>
          <div className="result">
            <b>製品数</b>
            <div style={{ fontSize: 32, fontWeight: 900, color: "var(--primary)" }}>
              {item.product_count.toLocaleString()}
            </div>
          </div>
        </div>
        {item.raw_materials && (
          <div className="result" style={{ marginBottom: 12 }}>
            <b>原材料例</b>
            <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.7 }}>{item.raw_materials}</p>
          </div>
        )}
        {item.products.length > 0 && (
          <div>
            <b style={{ fontSize: 14 }}>含有製品（抜粋）</b>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {item.products.slice(0, 20).map((p, i) => (
                <span key={i} className="tag" style={{ margin: 0, fontSize: 12 }}>{p}</span>
              ))}
              {item.products.length > 20 && (
                <span style={{ fontSize: 12, color: "var(--muted)", padding: "6px 0" }}>
                  他 {item.products.length - 20} 件
                </span>
              )}
            </div>
          </div>
        )}
      </>
    );
  };

  /* ── Pagination ── */
  const Pagination = () => {
    if (totalPages <= 1) return null;
    const pages = [];
    const start = Math.max(1, currentPage - 3);
    const end = Math.min(totalPages, currentPage + 3);
    for (let i = start; i <= end; i++) pages.push(i);

    return (
      <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 24, flexWrap: "wrap" }}>
        {currentPage > 1 && (
          <button className="btn" onClick={() => setPage(currentPage - 1)} style={{ padding: "8px 14px", minHeight: 36, fontSize: 13 }}>
            ←
          </button>
        )}
        {start > 1 && <button className="btn" onClick={() => setPage(1)} style={{ padding: "8px 14px", minHeight: 36, fontSize: 13 }}>1</button>}
        {start > 2 && <span style={{ padding: "8px 4px", color: "var(--muted)" }}>…</span>}
        {pages.map((p) => (
          <button
            key={p}
            className={`btn ${p === currentPage ? "active" : ""}`}
            onClick={() => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            style={{ padding: "8px 14px", minHeight: 36, fontSize: 13 }}
          >
            {p}
          </button>
        ))}
        {end < totalPages - 1 && <span style={{ padding: "8px 4px", color: "var(--muted)" }}>…</span>}
        {end < totalPages && (
          <button className="btn" onClick={() => setPage(totalPages)} style={{ padding: "8px 14px", minHeight: 36, fontSize: 13 }}>{totalPages}</button>
        )}
        {currentPage < totalPages && (
          <button className="btn" onClick={() => setPage(currentPage + 1)} style={{ padding: "8px 14px", minHeight: 36, fontSize: 13 }}>
            →
          </button>
        )}
      </div>
    );
  };

  const tags = mode === "cosmetics" ? COSMETIC_TAGS : HEALTH_TAGS;

  return (
    <>
      {/* ── Mode tabs ── */}
      <div className="card" style={{ marginTop: 0 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <button
            className={`btn ${mode === "cosmetics" ? "primary" : ""}`}
            onClick={() => switchMode("cosmetics")}
            style={{ fontSize: 15, padding: "12px 20px" }}
          >
            💄 化粧品成分検索
          </button>
          <button
            className={`btn ${mode === "health" ? "primary" : ""}`}
            onClick={() => switchMode("health")}
            style={{ fontSize: 15, padding: "12px 20px" }}
          >
            🌿 健康食品成分検索
          </button>
        </div>

        {/* Search + sort */}
        <div className="grid-2" style={{ gap: 12, marginBottom: 12 }}>
          <div>
            <input
              ref={inputRef}
              type="text"
              placeholder={mode === "cosmetics" ? "成分名・INCI名で検索…" : "成分名・機能で検索…"}
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 10,
                border: "1px solid #cfd7e3", fontSize: 14, background: "#fff",
                marginTop: 0,
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              className={`btn ${sort === "rec" ? "primary" : ""}`}
              onClick={() => { setSort("rec"); setPage(1); }}
              style={{ flex: 1, fontSize: 13 }}
            >
              おすすめ順
            </button>
            <button
              className={`btn ${sort === "pop" ? "primary" : ""}`}
              onClick={() => { setSort("pop"); setPage(1); }}
              style={{ flex: 1, fontSize: 13 }}
            >
              人気順
            </button>
          </div>
        </div>

        {/* Tag filter pills */}
        <div className="pill-grid">
          {tags.map((t) => (
            <button
              key={t}
              className={`pill ${activeTag === t ? "active" : ""}`}
              onClick={() => handleTag(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── Results ── */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>
            {mode === "cosmetics" ? "化粧品成分" : "健康食品成分"} 一覧
          </h2>
          {loading ? (
            <span style={{ color: "var(--muted)", fontSize: 13 }}>読み込み中…</span>
          ) : (
            <span style={{ color: "var(--muted)", fontSize: 13 }}>
              {filtered.length.toLocaleString()} 件  /  p.{currentPage}/{totalPages || 1}
            </span>
          )}
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--muted)" }}>
            データ読み込み中…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--muted)" }}>
            該当する成分が見つかりません
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 12,
          }}>
            {pageItems.map((item) =>
              mode === "cosmetics"
                ? <CosmeticCard key={(item as CosmeticItem).id} item={item as CosmeticItem} />
                : <HealthCard key={(item as HealthItem).id} item={item as HealthItem} />
            )}
          </div>
        )}

        <Pagination />
      </div>

      {/* ── Modal ── */}
      {modal && (
        <div
          className="modal active"
          onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}
        >
          <div className="modal-content">
            <div className="modal-top">
              <h2 style={{ margin: 0, fontSize: 18, lineHeight: 1.3 }}>
                {"jp" in modal ? (modal as CosmeticItem).jp : (modal as HealthItem).name}
              </h2>
              <button className="btn primary" onClick={() => setModal(null)} style={{ minHeight: 36, padding: "8px 16px", marginTop: 0 }}>
                閉じる
              </button>
            </div>
            <ModalBody />
          </div>
        </div>
      )}
    </>
  );
}
