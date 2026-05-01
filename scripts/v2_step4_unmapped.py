"""Step4: 未マッピング purpose 全解消 + purpose ある全行にタグ再チェック → intermediate_step4.csv"""
import re, pandas as pd
from pathlib import Path

ROOT   = Path(__file__).parent.parent / "beauty_health_project"
IN_CSV = ROOT / "intermediate_step3.csv"
OUT    = ROOT / "intermediate_step4.csv"

# 未マッピングだった「抗ケーキング剤」を追加
EXTRA_PURPOSE_MAP: list[tuple[str, str, str, str]] = [
    ("抗ケーキング剤", "固結防止剤", "Anti-Caking Agent", "防结块剂"),
    ("噴射剤", "噴射剤", "Propellant", "推进剂"),        # 念のため再確認
]

print(f"[Step4] 読み込み: {IN_CSV}")
df = pd.read_csv(IN_CSV, encoding="utf-8-sig", dtype=str, keep_default_na=False)
print(f"  総行数: {len(df):,}")

fixed = 0
for _, row in df.iterrows():
    pass  # 行数確認のみ

for idx, row in df.iterrows():
    purpose = row["purpose"]
    tags_jp = row["tags_jp"]
    for (keyword, jp, en, cn) in EXTRA_PURPOSE_MAP:
        if keyword in purpose:
            if jp not in tags_jp:
                # タグ追記
                sep = "|" if tags_jp else ""
                df.at[idx, "tags_jp"] = tags_jp + sep + jp
                df.at[idx, "tags_en"] = row["tags_en"] + ("|" if row["tags_en"] else "") + en
                df.at[idx, "tags_cn"] = row["tags_cn"] + ("|" if row["tags_cn"] else "") + cn
                fixed += 1

print(f"  「抗ケーキング剤」など追加マッピング: {fixed}件")

# purpose あるのにタグ空のまま残っているケース再チェック
mask = (df["purpose"].str.strip() != "") & (df["tags_jp"] == "")
print(f"  purpose有り・タグ空残り: {mask.sum()}件")

# 残った空欄に「その他」タグ付与（完全に未分類の成分）
for idx in df[mask].index:
    df.at[idx, "tags_jp"] = "その他"
    df.at[idx, "tags_en"] = "Other"
    df.at[idx, "tags_cn"] = "其他"

final_empty = (df["tags_jp"] == "").sum()
print(f"  最終タグ空欄残り: {final_empty}件（purpose も空欄の成分）")

df.to_csv(OUT, index=False, encoding="utf-8-sig")
print(f"[Step4] 完了 → {OUT.name}\n")
