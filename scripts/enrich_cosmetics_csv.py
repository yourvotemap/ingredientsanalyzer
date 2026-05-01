"""
cosmetic_ingredients.csv を機能性検索用に強化するスクリプト

追加列:
  tags_jp / tags_en / tags_cn  : 標準タグ（複数はパイプ区切り）
  score_moisture               : 保湿スコア 1-10
  score_barrier                : バリア・閉塞スコア 1-10
  score_brightening            : 美白・透明感スコア 1-10
  score_acne                   : 抗ニキビスコア 1-10
  score_soothing               : 鎮静・抗炎症スコア 1-10
  score_antioxidant            : 抗酸化スコア 1-10
  score_exfoliant              : ターンオーバー・角質ケアスコア 1-10
  score_uv                     : UV防御スコア 1-10
  score_antiaging              : エイジングケアスコア 1-10
  score_hair                   : ヘアケアスコア 1-10
  popularity_score             : 製品採用数から算出 1-100
  recommend_score              : 総合おすすめスコア 1-100
"""

import re
import math
import pandas as pd
from pathlib import Path

ROOT = Path(__file__).parent.parent
IN_CSV  = ROOT / "beauty_health_project" / "cosmetic_ingredients.csv"
OUT_CSV = ROOT / "beauty_health_project" / "cosmetic_ingredients_enriched.csv"

# -----------------------------------------------------------------------
# 1. purpose → タグ定義
#    各エントリ: (purposeパターン, jp, en, cn, スコアフィールド, スコア値)
# -----------------------------------------------------------------------
TAG_RULES: list[tuple[str, str, str, str, dict]] = [
    # --- 保湿 ---
    ("保湿", "保湿", "Moisturizing", "保湿",
     {"score_moisture": 9}),
    ("保水", "保湿", "Moisturizing", "保湿",
     {"score_moisture": 7}),
    ("湿潤", "保湿", "Moisturizing", "保湿",
     {"score_moisture": 8}),
    ("エモリエント", "エモリエント", "Emollient", "润肤",
     {"score_moisture": 7, "score_barrier": 6}),

    # --- バリア・閉塞 ---
    ("閉塞", "バリア", "Occlusive", "封闭",
     {"score_barrier": 10}),
    ("皮膚保護", "バリア", "Skin Protectant", "肤质保护",
     {"score_barrier": 8}),
    ("皮膜形成", "皮膜形成", "Film-Forming", "成膜",
     {"score_barrier": 7}),

    # --- 美白・ブライトニング ---
    ("美白", "美白", "Brightening", "美白",
     {"score_brightening": 10}),
    ("皮膚ブリーチ", "美白", "Brightening", "美白",
     {"score_brightening": 9}),
    ("褪色防止", "褪色防止", "Anti-Fading", "防褪色",
     {"score_brightening": 4}),

    # --- 抗ニキビ ---
    ("抗アクネ", "抗ニキビ", "Anti-Acne", "祛痘",
     {"score_acne": 10}),
    ("抗フケ", "スカルプケア", "Anti-Dandruff", "去屑",
     {"score_hair": 8}),

    # --- 鎮静・抗炎症 ---
    ("収れん", "収れん", "Astringent", "收敛",
     {"score_soothing": 8}),
    ("薬用収れん", "収れん", "Astringent", "收敛",
     {"score_soothing": 9}),
    ("外用鎮痛", "鎮静", "Soothing", "镇静",
     {"score_soothing": 9}),
    ("皮膚コンディショニング", "スキンケア", "Skin Conditioning", "护肤",
     {"score_moisture": 5, "score_soothing": 4}),

    # --- 抗酸化 ---
    ("酸化防止", "抗酸化", "Antioxidant", "抗氧化",
     {"score_antioxidant": 10}),

    # --- ターンオーバー・角質 ---
    ("角質柔軟", "角質ケア", "Exfoliant", "角质护理",
     {"score_exfoliant": 10}),
    ("剥離", "角質ケア", "Exfoliant", "角质护理",
     {"score_exfoliant": 8}),
    ("研磨", "スクラブ", "Scrub/Exfoliant", "磨砂",
     {"score_exfoliant": 9}),
    ("酵素", "酵素", "Enzyme", "酶",
     {"score_exfoliant": 7}),
    ("脱毛", "除毛", "Depilatory", "脱毛",
     {}),
    ("物理的脱毛", "除毛", "Depilatory", "脱毛",
     {}),

    # --- UV ---
    ("紫外線", "UV防御", "UV Protection", "防晒",
     {"score_uv": 10}),

    # --- エイジングケア ---
    ("パーマネント・ウェーブ", "パーマ", "Permanent Wave", "烫发",
     {}),

    # --- ヘアケア ---
    ("ヘアコンディショニング", "ヘアケア", "Hair Conditioning", "护发",
     {"score_hair": 9}),
    ("ヘアスタイリング", "ヘアスタイリング", "Hair Styling", "发型定型",
     {"score_hair": 6}),
    ("毛髪着色", "ヘアカラー", "Hair Coloring", "染发",
     {"score_hair": 7}),
    ("育毛", "育毛", "Hair Growth", "育发",
     {"score_hair": 10, "score_antiaging": 5}),
    ("発毛", "育毛", "Hair Growth", "育发",
     {"score_hair": 10}),

    # --- 口腔ケア ---
    ("口腔ケア", "口腔ケア", "Oral Care", "口腔护理",
     {}),
    ("口腔衛生", "口腔ケア", "Oral Care", "口腔护理",
     {}),
    ("抗う蝕", "虫歯予防", "Anti-Caries", "防龋",
     {}),

    # --- 制汗 ---
    ("制汗", "制汗", "Antiperspirant", "止汗",
     {}),

    # --- 消臭 ---
    ("消臭", "消臭", "Deodorant", "除臭",
     {}),

    # --- 抗菌 ---
    ("抗菌", "抗菌", "Antibacterial", "抗菌",
     {}),
    ("殺菌", "抗菌", "Antibacterial", "抗菌",
     {}),
    ("防腐", "防腐剤", "Preservative", "防腐",
     {}),
    ("抗黴", "防カビ", "Antifungal", "抗真菌",
     {}),

    # --- 洗浄 ---
    ("洗浄", "洗浄", "Cleansing", "清洁",
     {}),
    ("起泡", "起泡", "Foam Booster", "起泡",
     {}),
    ("消泡", "消泡", "Antifoaming", "消泡",
     {}),

    # --- 処方補助（機能スコアなし） ---
    ("乳化安定", "乳化", "Emulsifier", "乳化",
     {}),
    ("乳化剤", "乳化", "Emulsifier", "乳化",
     {}),
    ("可塑", "可塑剤", "Plasticizer", "增塑",
     {}),
    ("増量", "増量剤", "Bulking Agent", "填充",
     {}),
    ("結合", "結合剤", "Binding Agent", "粘合",
     {}),
    ("粘着", "粘着剤", "Adhesive", "粘合",
     {}),
    ("親水性増粘", "増粘剤", "Thickener", "增稠",
     {}),
    ("非水系増粘", "増粘剤", "Thickener", "增稠",
     {}),
    ("緩衝", "pH調整", "Buffering", "缓冲",
     {}),
    ("pH調整", "pH調整", "pH Adjuster", "pH调节",
     {}),
    ("溶剤", "溶剤", "Solvent", "溶剂",
     {}),
    ("可溶化", "可溶化剤", "Solubilizer", "增溶",
     {}),
    ("キレート", "キレート剤", "Chelating Agent", "螯合",
     {}),
    ("帯電防止", "帯電防止", "Antistatic", "抗静电",
     {}),
    ("香料", "香料", "Fragrance", "香料",
     {}),
    ("香味", "香料", "Fragrance", "香料",
     {}),
    ("着色", "着色剤", "Colorant", "着色",
     {}),
    ("不透明化", "不透明化剤", "Opacifier", "遮光",
     {}),
    ("表面改質", "表面改質剤", "Surface Modifier", "表面改性",
     {}),
    ("腐蝕防止", "腐食防止剤", "Corrosion Inhibitor", "防腐蚀",
     {}),
    ("噴射", "噴射剤", "Propellant", "推进剂",
     {}),
    ("忌避", "忌避剤", "Repellent", "驱避",
     {}),
    ("減粘", "粘度調整", "Viscosity Reducer", "降粘",
     {}),
    ("非活性剤系分散", "分散剤", "Dispersant", "分散剂",
     {}),
    ("吸着", "吸着剤", "Adsorbent", "吸附",
     {}),
    ("界面活性助剤", "乳化補助", "Surfactant Aid", "表活助剂",
     {}),
    ("酸化剤", "酸化剤", "Oxidizing Agent", "氧化剂",
     {}),
    ("還元剤", "還元剤", "Reducing Agent", "还原剂",
     {}),
    ("滑沢", "滑沢剤", "Lubricant", "润滑",
     {}),
    ("人工爪", "ネイルケア", "Nail Care", "指甲护理",
     {}),
    ("爪コンディショニング", "ネイルケア", "Nail Care", "指甲护理",
     {}),
    ("変性剤", "変性剤", "Denaturant", "变性",
     {}),
]


def match_tags(purpose: str) -> tuple[list[str], list[str], list[str], dict[str, int]]:
    """
    purpose 文字列からタグリストとスコア辞書を返す。
    同じタグは重複排除、スコアは最大値を採用。
    """
    jp_tags, en_tags, cn_tags = [], [], []
    scores: dict[str, int] = {}
    seen_jp: set[str] = set()

    # purpose は "/" や "、" で複数記述されることがある
    tokens = re.split(r"[/、，,]", purpose)

    for token in tokens:
        token = token.strip()
        if not token:
            continue
        for (pattern, jp, en, cn, sc) in TAG_RULES:
            if pattern in token:
                if jp not in seen_jp:
                    seen_jp.add(jp)
                    jp_tags.append(jp)
                    en_tags.append(en)
                    cn_tags.append(cn)
                for field, val in sc.items():
                    scores[field] = max(scores.get(field, 0), val)

    return jp_tags, en_tags, cn_tags, scores


def parse_commercial(raw: str) -> int:
    if not raw:
        return 0
    m = re.search(r"([\d,]+)", raw)
    if m:
        return int(m.group(1).replace(",", ""))
    return 0


def to_popularity(count: int, p95: float) -> int:
    """
    log スケールで 1-100 に正規化。
    p95 を 95 点にマッピング（外れ値が 100 に張り付くのを防ぐ）
    """
    if count <= 0:
        return 0
    log_val = math.log1p(count)
    log_p95 = math.log1p(p95) if p95 > 0 else 1.0
    return min(100, max(1, round(log_val / log_p95 * 95)))


# スコアフィールド一覧
SCORE_FIELDS = [
    "score_moisture", "score_barrier", "score_brightening",
    "score_acne", "score_soothing", "score_antioxidant",
    "score_exfoliant", "score_uv", "score_antiaging", "score_hair",
]

# recommend_score 重み（機能スコアを等ウェイト + popularity 30% 相当）
SCORE_WEIGHT = 0.6
POP_WEIGHT   = 0.4


def calc_recommend(scores: dict[str, int], popularity: int) -> int:
    func_vals = [scores.get(f, 0) for f in SCORE_FIELDS]
    max_func = max(func_vals) if func_vals else 0
    # 機能スコアを 1-10 → 1-100 にスケールしてから blendand
    func100 = max_func * 10
    raw = func100 * SCORE_WEIGHT + popularity * POP_WEIGHT
    return min(100, max(0, round(raw)))


# -----------------------------------------------------------------------
# メイン処理
# -----------------------------------------------------------------------
print(f"読み込み中: {IN_CSV}")
df = pd.read_csv(IN_CSV, encoding="utf-8-sig", dtype=str, keep_default_na=False)
print(f"  行数: {len(df):,}  列: {list(df.columns)}")

# commercial_products → 数値
df["_cp_num"] = df["commercial_products"].apply(parse_commercial)

# popularity_score 用の p95 を算出
cp_nonzero = df["_cp_num"][df["_cp_num"] > 0]
p95 = float(cp_nonzero.quantile(0.95)) if len(cp_nonzero) > 0 else 1.0
print(f"  commercial_products p95 = {p95:.0f}")

df["popularity_score"] = df["_cp_num"].apply(lambda x: to_popularity(x, p95))

# スコアフィールド初期化
for f in SCORE_FIELDS:
    df[f] = 0

# タグ列初期化
df["tags_jp"] = ""
df["tags_en"] = ""
df["tags_cn"] = ""

# purpose ごとに処理
print("  タグ・スコア付与中 ...")
for idx, row in df.iterrows():
    purpose = row.get("purpose", "") or ""
    jp, en, cn, sc = match_tags(purpose)

    df.at[idx, "tags_jp"] = "|".join(jp)
    df.at[idx, "tags_en"] = "|".join(en)
    df.at[idx, "tags_cn"] = "|".join(cn)

    for field, val in sc.items():
        df.at[idx, field] = val

# recommend_score
df["recommend_score"] = df.apply(
    lambda r: calc_recommend(
        {f: int(r[f]) for f in SCORE_FIELDS},
        int(r["popularity_score"])
    ),
    axis=1,
)

# 不要な作業列を削除
df.drop(columns=["_cp_num"], inplace=True)

# 列順を整理：元の列 + 追加列
added_cols = ["tags_jp", "tags_en", "tags_cn"] + SCORE_FIELDS + ["popularity_score", "recommend_score"]
original_cols = [c for c in df.columns if c not in added_cols]
df = df[original_cols + added_cols]

# 出力
df.to_csv(OUT_CSV, index=False, encoding="utf-8-sig")
print(f"  出力完了: {OUT_CSV}")
print(f"  サイズ: {OUT_CSV.stat().st_size / 1024:.0f} KB")

# サマリー
print("\n--- スコア分布サマリー ---")
for f in SCORE_FIELDS + ["popularity_score", "recommend_score"]:
    non_zero = df[df[f].astype(int) > 0][f].astype(int)
    if len(non_zero) > 0:
        print(f"  {f:25s}: 非ゼロ {len(non_zero):5,} 件  平均 {non_zero.mean():5.1f}  最大 {non_zero.max()}")
    else:
        print(f"  {f:25s}: 非ゼロ     0 件")

print("\n--- タグあり件数 ---")
has_tag = df[df["tags_jp"] != ""]
print(f"  タグあり: {len(has_tag):,} 件 / {len(df):,} 件 ({len(has_tag)/len(df)*100:.1f}%)")

print("\n--- よく使われるタグ top10 ---")
from collections import Counter
tag_counter: Counter = Counter()
for tags in df["tags_jp"]:
    for t in tags.split("|"):
        if t:
            tag_counter[t] += 1
for tag, cnt in tag_counter.most_common(10):
    print(f"  {tag:20s}: {cnt:,} 件")
