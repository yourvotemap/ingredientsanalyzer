"""Step6: recommend_score 再計算 → intermediate_step6.csv
新計算式:
  func_score  = 全機能スコアの加重平均（上位2スコアを重視）
  recommend   = func_score * 0.55 + popularity * 0.45
  重複成分は -5 ペナルティ
"""
import pandas as pd
from pathlib import Path

ROOT   = Path(__file__).parent.parent / "beauty_health_project"
IN_CSV = ROOT / "intermediate_step5.csv"
OUT    = ROOT / "intermediate_step6.csv"

SCORE_FIELDS = [
    "score_moisture","score_barrier","score_brightening","score_acne",
    "score_soothing","score_antioxidant","score_exfoliant","score_uv",
    "score_antiaging","score_hair",
]
CHUNK = 5000

print(f"[Step6] 読み込み: {IN_CSV}")
df = pd.read_csv(IN_CSV, encoding="utf-8-sig", dtype=str, keep_default_na=False)
for f in [c for c in df.columns if c.startswith("score_") or c in ("popularity_score","recommend_score")]:
    df[f] = df[f].astype(int)
print(f"  総行数: {len(df):,}")

def calc_recommend(row: pd.Series) -> int:
    vals = sorted([row[f] for f in SCORE_FIELDS], reverse=True)
    # 上位2スコアを2倍重み、残りを1倍
    top2 = vals[:2]
    rest = vals[2:]
    if sum(vals) == 0:
        func_score = 0.0
    else:
        weighted = sum(v * 2 for v in top2) + sum(rest)
        max_possible = 10 * 2 * 2 + 10 * 8  # 全10点満点のとき
        func_score = weighted / max_possible * 100

    pop = row["popularity_score"]
    raw = func_score * 0.55 + pop * 0.45

    # 重複ペナルティ
    if row.get("is_duplicate", "false") == "true":
        raw -= 5

    return max(0, min(100, round(raw)))

scores = []
total = len(df)
for i in range(0, total, CHUNK):
    chunk = df.iloc[i:i+CHUNK]
    s = [calc_recommend(r) for _, r in chunk.iterrows()]
    scores.extend(s)
    print(f"  [{i+len(chunk):,}/{total:,}] recommend_score 計算中...")

df["recommend_score"] = scores

# 分布確認
print("\n  recommend_score 分布:")
bins = [0,10,20,30,40,50,60,70,80,90,100]
for lo, hi in zip(bins, bins[1:]):
    n = ((df["recommend_score"] >= lo) & (df["recommend_score"] < hi)).sum()
    if hi == 100:
        n = ((df["recommend_score"] >= lo) & (df["recommend_score"] <= hi)).sum()
    bar = "█" * (n // 200)
    print(f"    {lo:3d}-{hi:3d}: {n:5,} {bar}")

df.to_csv(OUT, index=False, encoding="utf-8-sig")
print(f"[Step6] 完了 → {OUT.name}\n")
