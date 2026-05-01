"""
cosmetic_ingredients_import_ready.csv から public/data/cosmetics.json を生成
- 全16,527件 (is_duplicate=1 含む)
- 最小フィールドのみ (definition除外) で ~2MB目標
"""
import csv, json, math
from pathlib import Path

ROOT     = Path(__file__).parent.parent
IN_CSV   = ROOT / "beauty_health_project" / "cosmetic_ingredients_import_ready.csv"
OUT_JSON = ROOT / "public" / "data" / "cosmetics.json"

OUT_JSON.parent.mkdir(parents=True, exist_ok=True)

SCORE_FIELDS = [
    "score_moisture","score_barrier","score_brightening","score_acne",
    "score_soothing","score_antioxidant","score_exfoliant","score_uv",
    "score_antiaging","score_hair",
]

rows = []
with open(IN_CSV, encoding="utf-8") as f:
    for r in csv.DictReader(f):
        # 重複成分は除外（最良版のみ残す）
        if r.get("is_duplicate","0") == "1":
            continue
        tags = r.get("tags_jp","").strip()
        scores = {k: int(r.get(k,0) or 0) for k in SCORE_FIELDS}
        top_scores = [[k.replace("score_",""), v] for k,v in scores.items() if v>0]
        top_scores.sort(key=lambda x: -x[1])
        top_scores = top_scores[:3]

        rows.append({
            "id":    int(r.get("source_id",0) or 0),
            "jp":    r.get("name_jp",""),
            "inci":  r.get("name_inci",""),
            "tags":  tags.split("|") if tags else [],
            "rec":   int(r.get("recommend_score",0) or 0),
            "pop":   int(r.get("popularity_score",0) or 0),
            "def":   r.get("definition","")[:180],
            "sc":    top_scores,
        })

# recommend_score 降順ソート
rows.sort(key=lambda x: (-x["rec"], -x["pop"]))

with open(OUT_JSON, "w", encoding="utf-8") as f:
    json.dump(rows, f, ensure_ascii=False, separators=(",",":"))

size_kb = OUT_JSON.stat().st_size // 1024
print(f"出力: {OUT_JSON}  ({size_kb} KB)  {len(rows):,}件")
