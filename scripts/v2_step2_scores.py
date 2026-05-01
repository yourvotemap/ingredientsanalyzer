"""Step2: 全 score 列を 1〜10 自然分布化 → intermediate_step2.csv
定義文・成分名のキーワードでベーススコアを±補正し、値の種類を増やす。"""
import re, pandas as pd
from pathlib import Path

ROOT   = Path(__file__).parent.parent / "beauty_health_project"
IN_CSV = ROOT / "intermediate_step1.csv"
OUT    = ROOT / "intermediate_step2.csv"

CHUNK = 5000
SCORE_FIELDS = [
    "score_moisture","score_barrier","score_brightening","score_acne",
    "score_soothing","score_antioxidant","score_exfoliant","score_uv",
    "score_antiaging","score_hair",
]

# (field, patterns_boost+1, patterns_boost+2, patterns_penalty-1)
KEYWORD_RULES: list[tuple[str, list[str], list[str], list[str]]] = [
    ("score_moisture",
     [r"保湿|humectant|moistur|湿潤"],
     [r"高い保湿|優れた保湿|excellent.*moistur|high.*moistur|ヒアルロン酸|hyaluron|グリセリン|glycerin|コラーゲン|collagen|セラミド|ceramide|PCA|NMF"],
     [r"界面活性|Surfactant|乳化剤|防腐|Preservative"]),
    ("score_barrier",
     [r"エモリエント|emollient|皮膚保護|皮膜"],
     [r"閉塞|[Oo]cclusive|ワックス|[Ww]ax|ロウ|シリコーン|[Ss]ilicone|スクワラン|squalane"],
     [r"洗浄|Cleansing|起泡|foam"]),
    ("score_brightening",
     [r"美白|brightening|whitening|色素沈着|melanin|メラニン"],
     [r"ビタミンC|Ascorb|ナイアシンアミド|niacinamide|アルブチン|arbutin|コウジ酸|kojic|トラネキサム|tranexamic"],
     [r"着色剤|colorant|染料"]),
    ("score_acne",
     [r"抗アクネ|anti.?acne|ニキビ"],
     [r"サリチル酸|salicylic|グリコール酸|glycolic|過酸化ベンゾイル|benzoyl|ティーツリー|tea.?tree"],
     [r"油性|oleic|fatty acid"]),
    ("score_soothing",
     [r"鎮静|soothing|抗炎症|anti.?inflam|収れん"],
     [r"アラントイン|allantoin|アズレン|azulen|ビサボロール|bisabolol|パンテノール|panthenol|グリチルリチン|glycyrrhizin|カミツレ|chamomile"],
     [r"刺激|irritat"]),
    ("score_antioxidant",
     [r"酸化防止|antioxidant|抗酸化"],
     [r"ビタミンE|tocopherol|ビタミンC|ascorb|BHT|BHA|ポリフェノール|polyphenol|フラボノイド|flavonoid|レスベラトロール|resveratrol"],
     [r"酸化剤|oxidiz"]),
    ("score_exfoliant",
     [r"角質|exfoliat|剥離|研磨|peeling"],
     [r"AHA|グリコール酸|glycolic|乳酸|lactic|サリチル酸|salicylic|酵素|enzyme|パパイン|papain|ブロメライン|bromelain"],
     [r"保護|protect|barrier"]),
    ("score_uv",
     [r"紫外線|UV|ultraviolet|SPF|sun"],
     [r"UVA|UVB|broad.?spectrum|日焼け止め|sunscreen"],
     []),
    ("score_antiaging",
     [r"エイジング|aging|老化|しわ|wrinkle|ハリ|firmness|リフト|lift"],
     [r"レチノール|retinol|ペプチド|peptide|コラーゲン|collagen|セラミド|ceramide|ヒアルロン酸|hyaluron|ナイアシンアミド|niacinamide"],
     [r"防腐|preservative|溶剤|solvent"]),
    ("score_hair",
     [r"ヘア|hair|毛髪|育毛|発毛"],
     [r"ケラチン|keratin|パンテノール|panthenol|ビオチン|biotin|ミノキシジル|minoxidil|シスチン|cystine"],
     [r"皮膚|skin|顔|face"]),
]

print(f"[Step2] 読み込み: {IN_CSV}")
df = pd.read_csv(IN_CSV, encoding="utf-8-sig", dtype=str, keep_default_na=False)
for f in [c for c in df.columns if c.startswith("score_") or c in ("popularity_score","recommend_score")]:
    df[f] = df[f].astype(int)
print(f"  総行数: {len(df):,}")

def adjust_scores(row: pd.Series) -> dict[str, int]:
    text = f"{row['name_jp']} {row['name_inci']} {row['definition']} {row['purpose']}".lower()
    result = {}
    for field, boost1_pats, boost2_pats, penalty_pats in KEYWORD_RULES:
        base = int(row[field])
        if base == 0:
            continue  # 0 はそのまま（purpose に該当なし）
        adj = 0
        for p in boost2_pats:
            if re.search(p, text, re.I):
                adj = max(adj, 2)
                break
        if adj == 0:
            for p in boost1_pats:
                if re.search(p, text, re.I):
                    adj = max(adj, 1)
                    break
        for p in penalty_pats:
            if re.search(p, text, re.I):
                adj = min(adj, -1)
                break
        # popularity が高い成分は +1 (実績あり)
        pop = int(row.get("popularity_score", 0))
        if pop >= 80:
            adj += 1
        result[field] = max(1, min(10, base + adj))
    return result

# chunk 処理
all_adjustments: list[dict[str, int]] = []
total = len(df)
for i in range(0, total, CHUNK):
    chunk = df.iloc[i:i+CHUNK]
    adjs = [adjust_scores(r) for _, r in chunk.iterrows()]
    all_adjustments.extend(adjs)
    print(f"  [{i+len(chunk):,}/{total:,}] スコア補正中...")

for idx, adj in enumerate(all_adjustments):
    for field, val in adj.items():
        df.at[idx, field] = val

print("\n  補正後スコア分布:")
for f in SCORE_FIELDS:
    nz = df[df[f] > 0][f]
    if len(nz):
        print(f"    {f:25s}: 非ゼロ{len(nz):,}件  値={sorted(set(nz.tolist()))}  平均{nz.mean():.1f}")
    else:
        print(f"    {f:25s}: 全0")

df.to_csv(OUT, index=False, encoding="utf-8-sig")
print(f"[Step2] 完了 → {OUT.name}\n")
