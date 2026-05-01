"""Step3: purpose 空欄 1339件を name_jp/inci/definition から推定タグ付け → intermediate_step3.csv"""
import re, pandas as pd
from pathlib import Path

ROOT   = Path(__file__).parent.parent / "beauty_health_project"
IN_CSV = ROOT / "intermediate_step2.csv"
OUT    = ROOT / "intermediate_step3.csv"

# (pattern, jp, en, cn, score_updates)
INFER_RULES: list[tuple[str, str, str, str, dict[str, int]]] = [
    # 保湿
    (r"ヒアルロン酸|[Hh]yaluronic|[Hh]yaluronate|Sodium Hyaluronate",
     "保湿", "Moisturizing", "保湿", {"score_moisture": 10}),
    (r"グリセリン|[Gg]lycerin|[Gg]lycerol",
     "保湿", "Moisturizing", "保湿", {"score_moisture": 9}),
    (r"コラーゲン|[Cc]ollagen",
     "保湿|エイジングケア", "Moisturizing|Anti-Aging", "保湿|抗衰老", {"score_moisture": 8, "score_antiaging": 6}),
    (r"アミノ酸|[Aa]mino [Aa]cid|[Pp]yrrolidone|PCA|NMF",
     "保湿", "Moisturizing", "保湿", {"score_moisture": 8}),
    (r"セラミド|[Cc]eramide",
     "バリア|エイジングケア", "Barrier|Anti-Aging", "屏障|抗衰老", {"score_barrier": 10, "score_moisture": 8, "score_antiaging": 7}),
    (r"スクワラン|[Ss]qualane|スクワレン|[Ss]qualene",
     "バリア|エモリエント", "Occlusive|Emollient", "封闭|润肤", {"score_barrier": 8, "score_moisture": 7}),
    (r"シア脂|[Ss]hea [Bb]utter|[Ss]hea",
     "バリア|エモリエント", "Occlusive|Emollient", "封闭|润肤", {"score_barrier": 9, "score_moisture": 7}),
    (r"ホホバ|[Jj]ojoba",
     "バリア|エモリエント", "Occlusive|Emollient", "封闭|润肤", {"score_barrier": 8, "score_moisture": 7}),

    # 美白
    (r"ビタミンC|アスコルビン酸|[Aa]scorbic|[Aa]scorbyl|アスコルビル",
     "美白|抗酸化", "Brightening|Antioxidant", "美白|抗氧化", {"score_brightening": 9, "score_antioxidant": 9, "score_antiaging": 7}),
    (r"ナイアシンアミド|[Nn]iacinamide",
     "美白|スキンケア", "Brightening|Skin Conditioning", "美白|护肤", {"score_brightening": 9, "score_antiaging": 8, "score_soothing": 5}),
    (r"アルブチン|[Aa]rbutin",
     "美白", "Brightening", "美白", {"score_brightening": 10}),
    (r"コウジ酸|[Kk]ojic",
     "美白", "Brightening", "美白", {"score_brightening": 9}),
    (r"トラネキサム酸|[Tt]ranexamic",
     "美白|鎮静", "Brightening|Soothing", "美白|镇静", {"score_brightening": 9, "score_soothing": 6}),
    (r"ハイドロキノン|[Hh]ydroquinone",
     "美白", "Brightening", "美白", {"score_brightening": 10}),

    # 抗酸化
    (r"ビタミンE|トコフェロール|[Tt]ocopherol",
     "抗酸化", "Antioxidant", "抗氧化", {"score_antioxidant": 9, "score_antiaging": 7}),
    (r"BHT|ジブチルヒドロキシトルエン",
     "抗酸化", "Antioxidant", "抗氧化", {"score_antioxidant": 8}),
    (r"BHA|ブチルヒドロキシアニソール",
     "抗酸化", "Antioxidant", "抗氧化", {"score_antioxidant": 8}),
    (r"レスベラトロール|[Rr]esveratrol",
     "抗酸化|エイジングケア", "Antioxidant|Anti-Aging", "抗氧化|抗衰老", {"score_antioxidant": 9, "score_antiaging": 8}),
    (r"アスタキサンチン|[Aa]staxanthin",
     "抗酸化|エイジングケア", "Antioxidant|Anti-Aging", "抗氧化|抗衰老", {"score_antioxidant": 9, "score_antiaging": 8}),
    (r"CoQ10|コエンザイムQ10|[Uu]biquinone",
     "抗酸化|エイジングケア", "Antioxidant|Anti-Aging", "抗氧化|抗衰老", {"score_antioxidant": 8, "score_antiaging": 7}),
    (r"フラーレン|[Ff]ullerene",
     "抗酸化|エイジングケア", "Antioxidant|Anti-Aging", "抗氧化|抗衰老", {"score_antioxidant": 9, "score_antiaging": 8}),

    # エイジングケア
    (r"レチノール|[Rr]etinol|レチニル|[Rr]etinyl",
     "エイジングケア", "Anti-Aging", "抗衰老", {"score_antiaging": 9, "score_brightening": 6}),
    (r"ペプチド|[Pp]eptide|ペプタイド",
     "エイジングケア", "Anti-Aging", "抗衰老", {"score_antiaging": 7}),
    (r"[Aa]rgireline|アルジルリン|Acetyl [Hh]exapeptide",
     "エイジングケア", "Anti-Aging", "抗衰老", {"score_antiaging": 8}),
    (r"[Mm]atrixyl|マトリキシル|[Pp]almitoyl [Pp]entapeptide",
     "エイジングケア", "Anti-Aging", "抗衰老", {"score_antiaging": 8}),

    # UV
    (r"[Uu]ltraviolet|[Uu]V[- ]filter|[Ss]unscreen|[Ss]un [Pp]rotect|紫外線吸収|UV吸収",
     "UV防御", "UV Protection", "防晒", {"score_uv": 10}),
    (r"[Oo]xybenzone|[Bb]enzophenone|[Aa]vobenzone|[Oo]ctocrylene|メトキシケイヒ酸|Methoxycinnamate",
     "UV防御", "UV Protection", "防晒", {"score_uv": 10}),
    (r"酸化亜鉛|[Zz]inc [Oo]xide",
     "UV防御|バリア", "UV Protection|Barrier", "防晒|屏障", {"score_uv": 9, "score_barrier": 7}),
    (r"酸化チタン|[Tt]itanium [Dd]ioxide",
     "UV防御", "UV Protection", "防晒", {"score_uv": 9}),

    # 鎮静
    (r"アラントイン|[Aa]llantoin",
     "鎮静", "Soothing", "镇静", {"score_soothing": 9}),
    (r"ビサボロール|[Bb]isabolol",
     "鎮静", "Soothing", "镇静", {"score_soothing": 9}),
    (r"パンテノール|[Pp]anthenol|[Pp]antothenic",
     "鎮静", "Soothing", "镇静", {"score_soothing": 8, "score_moisture": 6}),
    (r"グリチルリチン|[Gg]lycyrrhizin|甘草|[Ll]icorice",
     "鎮静", "Soothing", "镇静", {"score_soothing": 9}),
    (r"カミツレ|カモミール|[Cc]hamomile|[Aa]zulen|アズレン",
     "鎮静", "Soothing", "镇静", {"score_soothing": 9}),

    # 抗ニキビ
    (r"サリチル酸|[Ss]alicylic",
     "抗ニキビ|角質ケア", "Anti-Acne|Exfoliant", "祛痘|角质护理", {"score_acne": 9, "score_exfoliant": 8}),
    (r"過酸化ベンゾイル|[Bb]enzoyl [Pp]eroxide",
     "抗ニキビ", "Anti-Acne", "祛痘", {"score_acne": 10}),
    (r"ティーツリー|[Tt]ea [Tt]ree|[Mm]elaleuca",
     "抗ニキビ|抗菌", "Anti-Acne|Antibacterial", "祛痘|抗菌", {"score_acne": 8, "score_soothing": 6}),

    # 角質ケア
    (r"グリコール酸|[Gg]lycolic [Aa]cid",
     "角質ケア|エイジングケア", "Exfoliant|Anti-Aging", "角质护理|抗衰老", {"score_exfoliant": 9, "score_antiaging": 6}),
    (r"乳酸|[Ll]actic [Aa]cid",
     "角質ケア|保湿", "Exfoliant|Moisturizing", "角质护理|保湿", {"score_exfoliant": 7, "score_moisture": 5}),
    (r"パパイン|[Pp]apain|ブロメライン|[Bb]romelain",
     "角質ケア", "Exfoliant", "角质护理", {"score_exfoliant": 8}),
    (r"酵素|[Ee]nzyme",
     "角質ケア", "Exfoliant", "角质护理", {"score_exfoliant": 6}),

    # ヘアケア
    (r"ケラチン|[Kk]eratin",
     "ヘアケア", "Hair Conditioning", "护发", {"score_hair": 9}),
    (r"ビオチン|[Bb]iotin",
     "ヘアケア|育毛", "Hair Conditioning|Hair Growth", "护发|育发", {"score_hair": 8}),
    (r"ミノキシジル|[Mm]inoxidil",
     "育毛", "Hair Growth", "育发", {"score_hair": 10}),
    (r"シスチン|[Cc]ystine|システイン|[Cc]ysteine",
     "ヘアケア", "Hair Conditioning", "护发", {"score_hair": 7}),

    # 乳化・処方補助（機能スコアなし）
    (r"乳化|[Ee]mulsif",
     "乳化", "Emulsifier", "乳化", {}),
    (r"増粘|[Tt]hicken|[Gg]elling",
     "増粘剤", "Thickener", "增稠", {}),
    (r"防腐|[Pp]reservat",
     "防腐剤", "Preservative", "防腐", {}),
    (r"香料|[Ff]ragrance|香気|[Aa]roma",
     "香料", "Fragrance", "香料", {}),
    (r"溶剤|[Ss]olvent",
     "溶剤", "Solvent", "溶剂", {}),
    (r"洗浄|[Cc]leansing|[Ss]urfactant|界面活性",
     "洗浄", "Cleansing", "清洁", {}),
    (r"着色|[Cc]olorant|[Pp]igment|染料",
     "着色剤", "Colorant", "着色", {}),
    (r"pH|緩衝|[Bb]uffer",
     "pH調整", "pH Adjuster", "pH调节", {}),
]

def infer_from_text(name_jp: str, name_inci: str, definition: str) -> tuple[list,list,list,dict]:
    text = f"{name_jp} {name_inci} {definition}"
    jp_tags: list[str] = []
    en_tags: list[str] = []
    cn_tags: list[str] = []
    scores: dict[str,int] = {}
    seen: set[str] = set()
    for pat, jp, en, cn, sc in INFER_RULES:
        if re.search(pat, text, re.I):
            for j in jp.split("|"):
                if j not in seen:
                    seen.add(j)
                    jp_tags.append(j)
                    en_tags.append(en.split("|")[jp.split("|").index(j)] if "|" in en else en)
                    cn_tags.append(cn.split("|")[jp.split("|").index(j)] if "|" in cn else cn)
            for f, v in sc.items():
                scores[f] = max(scores.get(f, 0), v)
    return jp_tags, en_tags, cn_tags, scores

print(f"[Step3] 読み込み: {IN_CSV}")
df = pd.read_csv(IN_CSV, encoding="utf-8-sig", dtype=str, keep_default_na=False)
for f in [c for c in df.columns if c.startswith("score_") or c in ("popularity_score","recommend_score")]:
    df[f] = df[f].astype(int)
print(f"  総行数: {len(df):,}")

mask_empty = df["tags_jp"] == ""
print(f"  タグ空欄: {mask_empty.sum():,}件 → 推定タグ付け開始")

filled = 0
SCORE_FIELDS = [
    "score_moisture","score_barrier","score_brightening","score_acne",
    "score_soothing","score_antioxidant","score_exfoliant","score_uv",
    "score_antiaging","score_hair",
]

targets = df[mask_empty].index.tolist()
for i, idx in enumerate(targets):
    row = df.loc[idx]
    jp, en, cn, sc = infer_from_text(row["name_jp"], row["name_inci"], row["definition"])
    if jp:
        df.at[idx, "tags_jp"] = "|".join(jp)
        df.at[idx, "tags_en"] = "|".join(en)
        df.at[idx, "tags_cn"] = "|".join(cn)
        for f, v in sc.items():
            if f in SCORE_FIELDS:
                df.at[idx, f] = max(int(df.at[idx, f]), v)
        filled += 1
    if (i+1) % 200 == 0 or i+1 == len(targets):
        print(f"  [{i+1:,}/{len(targets):,}] タグ推定中... (付与済: {filled}件)")

still_empty = (df["tags_jp"] == "").sum()
print(f"  推定タグ付与: {filled:,}件  残り空欄: {still_empty:,}件")

df.to_csv(OUT, index=False, encoding="utf-8-sig")
print(f"[Step3] 完了 → {OUT.name}\n")
