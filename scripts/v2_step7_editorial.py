"""Step7: 上位200成分を人間目線で順位補正 → cosmetic_ingredients_enriched_v2.csv
・機能のない処方補助成分（溶剤・防腐剤・pH調整剤）を人気ベースで過大評価しないよう調整
・実績のある機能性成分をブースト
・最終 recommend_score を 0-100 に正規化して出力
"""
import re, pandas as pd
from pathlib import Path

ROOT   = Path(__file__).parent.parent / "beauty_health_project"
IN_CSV = ROOT / "intermediate_step6.csv"
OUT    = ROOT / "cosmetic_ingredients_enriched_v2.csv"

CHUNK = 5000

# -----------------------------------------------------------------------
# 編集ルール
# 成分名・タグ・purpose に合致した場合にスコアを補正
# -----------------------------------------------------------------------

# 機能スコア合計が低いのに popularity が高い「処方補助成分」ペナルティ
FUNCTIONAL_WEAK_TAGS = {
    "溶剤", "防腐剤", "pH調整", "乳化", "増粘剤", "消泡", "噴射剤",
    "変性剤", "帯電防止", "固結防止剤", "腐食防止剤", "着色剤",
    "結合剤", "粘着剤", "不透明化剤", "可塑剤", "増量剤",
}

# 特定の処方補助成分名で penalty
AUXILIARY_PATTERNS = re.compile(
    r"^(水$|精製水|蒸留水|フェノキシエタノール|メチルパラベン|エチルパラベン|"
    r"プロピルパラベン|ブチルパラベン|ベンジルアルコール|"
    r"ソルビン酸|デヒドロ酢酸|安息香酸|クエン酸三|リン酸|塩酸|水酸化|"
    r"エタノール$|イソプロパノール|ブタン$|プロパン$|イソブタン)"
)

# 機能性が高いと知られる有名成分ブースト
BOOST_MAP: dict[re.Pattern, int] = {
    re.compile(r"ヒアルロン酸|Hyaluronate|Hyaluronic"): 15,
    re.compile(r"ナイアシンアミド|Niacinamide"): 15,
    re.compile(r"レチノール|Retinol|Retinyl"): 15,
    re.compile(r"セラミド|Ceramide"): 12,
    re.compile(r"アスコルビン酸|Ascorbic Acid|アスコルビル"): 12,
    re.compile(r"ペプチド|Peptide|ペプタイド"): 10,
    re.compile(r"アルブチン|Arbutin"): 12,
    re.compile(r"グリセリン$|Glycerin$|Glycerol$"): 8,
    re.compile(r"スクワラン|Squalane"): 8,
    re.compile(r"シア脂|Shea Butter"): 8,
    re.compile(r"アラントイン|Allantoin"): 8,
    re.compile(r"パンテノール|Panthenol"): 8,
    re.compile(r"トコフェロール|Tocopherol"): 8,
    re.compile(r"グリチルリチン|Glycyrrhizin|甘草"): 8,
    re.compile(r"コラーゲン|Collagen"): 7,
    re.compile(r"レスベラトロール|Resveratrol"): 10,
    re.compile(r"アスタキサンチン|Astaxanthin"): 10,
    re.compile(r"フラーレン|Fullerene"): 10,
    re.compile(r"コエンザイムQ10|CoQ10|Ubiquinone"): 8,
    re.compile(r"ビサボロール|Bisabolol"): 8,
    re.compile(r"アズレン|Azulene"): 7,
    re.compile(r"トラネキサム酸|Tranexamic"): 10,
    re.compile(r"コウジ酸|Kojic"): 10,
    re.compile(r"アルジルリン|Argireline|Acetyl Hexapeptide"): 10,
    re.compile(r"グリコール酸|Glycolic Acid"): 8,
}

def apply_editorial(row: pd.Series) -> int:
    score = int(row["recommend_score"])
    name = row["name_jp"]
    inci = row["name_inci"]
    tags = set(row["tags_jp"].split("|"))
    name_text = f"{name} {inci}"

    # 処方補助成分ペナルティ：機能スコア合計が低い AND 機能タグなし
    func_sum = sum(
        int(row[f]) for f in [
            "score_moisture","score_barrier","score_brightening","score_acne",
            "score_soothing","score_antioxidant","score_exfoliant","score_uv",
            "score_antiaging","score_hair",
        ]
    )
    weak_tag_count = len(tags & FUNCTIONAL_WEAK_TAGS)
    all_weak = tags and tags.issubset(FUNCTIONAL_WEAK_TAGS | {""})

    if func_sum == 0 and all_weak:
        score = max(0, score - 20)
    elif AUXILIARY_PATTERNS.search(name):
        score = max(0, score - 25)

    # ブースト
    for pat, boost in BOOST_MAP.items():
        if pat.search(name_text):
            score = min(100, score + boost)
            break  # 最初にマッチした1ルールのみ適用

    return max(0, min(100, score))

print(f"[Step7] 読み込み: {IN_CSV}")
df = pd.read_csv(IN_CSV, encoding="utf-8-sig", dtype=str, keep_default_na=False)
for f in [c for c in df.columns if c.startswith("score_") or c in ("popularity_score","recommend_score")]:
    df[f] = df[f].astype(int)
print(f"  総行数: {len(df):,}")

new_scores = []
total = len(df)
for i in range(0, total, CHUNK):
    chunk = df.iloc[i:i+CHUNK]
    s = [apply_editorial(r) for _, r in chunk.iterrows()]
    new_scores.extend(s)
    print(f"  [{i+len(chunk):,}/{total:,}] 編集補正中...")

df["recommend_score"] = new_scores

# 上位200件確認
top200 = df.nlargest(200, "recommend_score")[
    ["name_jp","name_inci","tags_jp","popularity_score","recommend_score"]
]
print("\n  ★ 上位30件（補正後）:")
for _, r in top200.head(30).iterrows():
    print(f"    [{r['recommend_score']:3d}] pop={r['popularity_score']:3d}  {r['name_jp'][:30]}")
    print(f"         tags: {r['tags_jp'][:60]}")

# 最終分布
print("\n  最終 recommend_score 分布:")
bins = [0,10,20,30,40,50,60,70,80,90,100]
for lo, hi in zip(bins, bins[1:]):
    n = ((df["recommend_score"] >= lo) & (df["recommend_score"] < hi)).sum()
    if hi == 100:
        n = ((df["recommend_score"] >= lo) & (df["recommend_score"] <= hi)).sum()
    bar = "█" * (n // 200)
    print(f"    {lo:3d}-{hi:3d}: {n:5,} {bar}")

# 列整理（作業用列削除）
drop_cols = [c for c in df.columns if c.startswith("_")]
if drop_cols:
    df.drop(columns=drop_cols, inplace=True)

df.to_csv(OUT, index=False, encoding="utf-8-sig")
size_kb = OUT.stat().st_size // 1024
print(f"\n[Step7] 完了 → {OUT.name} ({size_kb:,} KB)")
print(f"  最終列: {list(df.columns)}\n")
