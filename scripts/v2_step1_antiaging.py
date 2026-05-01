"""Step1: antiaging スコア再構築 → intermediate_step1.csv"""
import re, pandas as pd
from pathlib import Path

ROOT   = Path(__file__).parent.parent / "beauty_health_project"
IN_CSV = ROOT / "cosmetic_ingredients_enriched.csv"
OUT    = ROOT / "intermediate_step1.csv"

ANTIAGING_RULES: list[tuple[str, int]] = [
    (r"レチノール|Retinol|Retinyl", 9),
    (r"ペプチド|[Pp]eptide|ペプタイド", 7),
    (r"成長因子|EGF|FGF|HGF|IGF|Sh-Oligopeptide|sh-oligopeptide", 9),
    (r"レスベラトロール|[Rr]esveratrol", 8),
    (r"コエンザイムQ10|CoQ10|Ubiquinone|ubiquinone", 7),
    (r"アスタキサンチン|[Aa]staxanthin", 8),
    (r"プラセンタ|[Pp]lacenta|Placental", 7),
    (r"ナイアシンアミド|[Nn]iacinamide", 8),
    (r"アルジルリン|Argireline|Acetyl Hexapeptide|Acetyl hexapeptide", 8),
    (r"マトリキシル|Matrixyl|Palmitoyl Pentapeptide|Palmitoyl Tripeptide|palmitoyl", 8),
    (r"セラミド|[Cc]eramide", 7),
    (r"フラーレン|[Ff]ullerene", 8),
    (r"幹細胞|[Ss]tem [Cc]ell|StemCell", 8),
    (r"コラーゲン|[Cc]ollagen", 6),
    (r"エラスチン|[Ee]lastin", 6),
    (r"コエンザイム|[Cc]oenzyme", 6),
    (r"DMAE|[Dd]eanol", 7),
    (r"グルタチオン|[Gg]lutathione", 7),
    (r"SOD|スーパーオキシドジスムターゼ|Superoxide Dismutase", 7),
    (r"カタラーゼ|[Cc]atalase", 6),
    (r"テロメア|[Tt]elomer", 8),
    (r"SIRT|サーチュイン|[Ss]irtuin", 7),
    (r"グリコール酸|Glycolic Acid|glycolic", 7),
    (r"乳酸|Lactic Acid|lactic acid", 6),
    (r"AHA|Alpha Hydroxy|アルファヒドロキシ", 7),
    (r"BHA|Beta Hydroxy|サリチル酸|Salicylic", 6),
    (r"フィチン酸|[Pp]hytic [Aa]cid", 5),
    (r"カルニチン|[Cc]arnitine", 5),
    (r"プロリン|[Pp]roline|ヒドロキシプロリン|[Hh]ydroxyproline", 5),
    (r"ビタミンA|Vitamin A|ビタミンＡ", 8),
    (r"ビタミンC|Vitamin C|アスコルビン|Ascorb", 7),
    (r"ビタミンE|Vitamin E|トコフェロール|Tocopherol", 7),
    (r"フラボノイド|[Ff]lavonoid", 6),
    (r"ポリフェノール|[Pp]olyphenol", 6),
    (r"カロテン|[Cc]aroten|カロチン", 6),
    (r"アデノシン|[Aa]denosine", 7),
    (r"スクワラン|[Ss]qualane|スクワレン|[Ss]qualene", 6),
    (r"リポ酸|Lipoic Acid|Alpha Lipoic|アルファリポ", 7),
]

# antiaging に寄与する purpose キーワード
ANTIAGING_PURPOSE = [r"美白", r"皮膚ブリーチ", r"皮膚コンディショニング"]

CHUNK = 5000

print(f"[Step1] 読み込み: {IN_CSV}")
df = pd.read_csv(IN_CSV, encoding="utf-8-sig", dtype=str, keep_default_na=False)
for f in [c for c in df.columns if c.startswith("score_") or c in ("popularity_score","recommend_score")]:
    df[f] = df[f].astype(int)
print(f"  総行数: {len(df):,}")

def calc_antiaging(name_jp: str, name_inci: str, definition: str, purpose: str) -> int:
    text = f"{name_jp} {name_inci} {definition}"
    score = 0
    for pattern, val in ANTIAGING_RULES:
        if re.search(pattern, text):
            score = max(score, val)
    # purpose に美白系があれば antiaging +=2
    for p in ANTIAGING_PURPOSE:
        if re.search(p, purpose):
            score = max(score, 4)
    return min(score, 10)

antiaging_scores = []
total = len(df)
for i in range(0, total, CHUNK):
    chunk = df.iloc[i:i+CHUNK]
    scores = [
        calc_antiaging(r["name_jp"], r["name_inci"], r["definition"], r["purpose"])
        for _, r in chunk.iterrows()
    ]
    antiaging_scores.extend(scores)
    print(f"  [{i+len(chunk):,}/{total:,}] antiaging 付与中...")

df["score_antiaging"] = antiaging_scores
nonzero = (df["score_antiaging"] > 0).sum()
print(f"  score_antiaging 非ゼロ: {nonzero:,}件  分布: {sorted(set(df['score_antiaging'].tolist()))}")

df.to_csv(OUT, index=False, encoding="utf-8-sig")
print(f"[Step1] 完了 → {OUT.name}\n")
