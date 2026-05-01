"""Step5: duplicate_group_id / is_duplicate 追加 → intermediate_step5.csv"""
import re, pandas as pd
from pathlib import Path

ROOT   = Path(__file__).parent.parent / "beauty_health_project"
IN_CSV = ROOT / "intermediate_step4.csv"
OUT    = ROOT / "intermediate_step5.csv"

print(f"[Step5] 読み込み: {IN_CSV}")
df = pd.read_csv(IN_CSV, encoding="utf-8-sig", dtype=str, keep_default_na=False)
print(f"  総行数: {len(df):,}")

df["duplicate_group_id"] = ""
df["is_duplicate"] = "false"

group_id = 1
assigned: dict[int, str] = {}   # index → group_id

# ① name_jp 完全一致
print("  name_jp 重複チェック...")
name_jp_groups = df[df["name_jp"].str.strip() != ""].groupby("name_jp")
for name, grp in name_jp_groups:
    if len(grp) > 1:
        gid = f"DUP-{group_id:04d}"
        group_id += 1
        for idx in grp.index:
            assigned[idx] = gid

# ② name_inci 完全一致（ただし空欄除く）
print("  name_inci 重複チェック...")
inci_groups = df[df["name_inci"].str.strip() != ""].groupby("name_inci")
for inci, grp in inci_groups:
    if len(grp) > 1:
        idxs = grp.index.tolist()
        # すでに同じグループに入っているか確認
        existing_gids = {assigned[i] for i in idxs if i in assigned}
        if len(existing_gids) == 0:
            gid = f"DUP-{group_id:04d}"
            group_id += 1
            for idx in idxs:
                if idx not in assigned:
                    assigned[idx] = gid
        else:
            # 既存グループにマージ
            gid = sorted(existing_gids)[0]
            for idx in idxs:
                if idx not in assigned:
                    assigned[idx] = gid

# ③ name_jp 先頭15文字一致（表記ゆれ）
print("  先頭15文字 表記ゆれチェック...")
df["_prefix"] = df["name_jp"].str[:15].str.strip()
prefix_groups = df[df["_prefix"].str.len() > 4].groupby("_prefix")
for prefix, grp in prefix_groups:
    if len(grp) > 1:
        idxs = grp.index.tolist()
        existing_gids = {assigned[i] for i in idxs if i in assigned}
        if len(existing_gids) == 0:
            gid = f"DUP-{group_id:04d}"
            group_id += 1
            for idx in idxs:
                if idx not in assigned:
                    assigned[idx] = gid
        else:
            gid = sorted(existing_gids)[0]
            for idx in idxs:
                if idx not in assigned:
                    assigned[idx] = gid
df.drop(columns=["_prefix"], inplace=True)

# 書き込み
for idx, gid in assigned.items():
    df.at[idx, "duplicate_group_id"] = gid
    df.at[idx, "is_duplicate"] = "true"

total_dup = (df["is_duplicate"] == "true").sum()
total_groups = df["duplicate_group_id"].str.startswith("DUP").sum()
print(f"  重複フラグ付与: {total_dup:,}件  グループ数: {len(set(assigned.values()))}")

df.to_csv(OUT, index=False, encoding="utf-8-sig")
print(f"[Step5] 完了 → {OUT.name}\n")
