"""
cosmetic_ingredients_enriched.csv 品質監査スクリプト
"""
import re
import math
import pandas as pd
from collections import Counter
from pathlib import Path

ROOT    = Path(__file__).parent.parent / "beauty_health_project"
IN_CSV  = ROOT / "cosmetic_ingredients_enriched.csv"
RPT_TXT = ROOT / "audit_report.txt"

df = pd.read_csv(IN_CSV, encoding="utf-8-sig", dtype=str, keep_default_na=False)
SCORE_FIELDS = [
    "score_moisture", "score_barrier", "score_brightening",
    "score_acne", "score_soothing", "score_antioxidant",
    "score_exfoliant", "score_uv", "score_antiaging", "score_hair",
]
for f in SCORE_FIELDS + ["popularity_score", "recommend_score"]:
    df[f] = df[f].astype(int)

lines: list[str] = []
def h(title: str):
    lines.append("\n" + "="*70)
    lines.append(f"  {title}")
    lines.append("="*70)
def p(*args):
    lines.append("  " + " ".join(str(a) for a in args))

total = len(df)
h(f"監査対象: {IN_CSV.name}  総行数: {total:,}")

# -----------------------------------------------------------------------
# 1. tags空欄件数
# -----------------------------------------------------------------------
h("1. tags_jp / en / cn 空欄件数")
for col in ["tags_jp", "tags_en", "tags_cn"]:
    empty = (df[col] == "").sum()
    p(f"{col}: 空欄 {empty:,} 件 ({empty/total*100:.1f}%)")

# -----------------------------------------------------------------------
# 2. purpose あるのにタグ未生成
# -----------------------------------------------------------------------
h("2. purpose あるのにタグ未生成")
has_purpose = df["purpose"].str.strip() != ""
no_tag      = df["tags_jp"] == ""
unmapped    = df[has_purpose & no_tag]
p(f"件数: {len(unmapped):,} 件")
# purposeの内訳
purpose_counter: Counter = Counter()
for row in unmapped["purpose"]:
    for t in re.split(r"[/、，,]", row):
        t = t.strip()
        if t:
            purpose_counter[t] += 1
p("未マッピング purpose トークン（上位20件）:")
for tok, cnt in purpose_counter.most_common(20):
    p(f"    {tok}: {cnt}件")

# -----------------------------------------------------------------------
# 3. 誤分類疑いタグ上位100件
# -----------------------------------------------------------------------
h("3. 誤分類疑いサンプル（purpose と tags_jp の不一致）")

suspicions: list[tuple[str, str, str, str]] = []

for _, row in df.iterrows():
    purpose = row["purpose"]
    tags    = row["tags_jp"]
    name    = row["name_jp"]
    if not purpose:
        continue

    issues = []

    # 美白purposeがあるのにブライトニングタグなし
    if re.search(r"美白|ブリーチ", purpose) and "美白" not in tags:
        issues.append("美白purposeなのに美白タグなし")

    # 保湿purposeがあるのに保湿タグなし
    if re.search(r"保湿|湿潤|保水", purpose) and "保湿" not in tags and "エモリエント" not in tags:
        issues.append("保湿purposeなのに保湿・エモリエントタグなし")

    # UV purposeがあるのにUVタグなし
    if "紫外線" in purpose and "UV防御" not in tags:
        issues.append("紫外線purposeなのにUVタグなし")

    # 防腐剤purposeなのにそれらしいタグがない
    if "防腐" in purpose and "防腐剤" not in tags:
        issues.append("防腐purposeなのに防腐タグなし")

    # 洗浄purposeなのに洗浄タグなし
    if "洗浄" in purpose and "洗浄" not in tags:
        issues.append("洗浄purposeなのに洗浄タグなし")

    # スキンケアタグ（皮膚コンディショニング）が付いているのに機能スコアが全部0
    if "スキンケア" in tags:
        func_sum = sum(row[f] for f in SCORE_FIELDS)
        if func_sum == 0:
            issues.append("スキンケアタグのみで機能スコア全0（汎用すぎる分類）")

    for issue in issues:
        suspicions.append((name, purpose[:60], tags[:60], issue))

p(f"疑義件数: {len(suspicions):,} 件（上位100件を表示）")
for name, pur, tag, issue in suspicions[:100]:
    p(f"  [{issue}]")
    p(f"    成分: {name}")
    p(f"    purpose: {pur}")
    p(f"    tags_jp: {tag}")

# -----------------------------------------------------------------------
# 4. recommend_score 上位100件チェック
# -----------------------------------------------------------------------
h("4. recommend_score 上位100件（サンプル30件表示）")
top100 = df.nlargest(100, "recommend_score")[
    ["name_jp", "name_inci", "tags_jp", "popularity_score", "recommend_score"]
    + SCORE_FIELDS
].reset_index(drop=True)

p("上位30件:")
for _, r in top100.head(30).iterrows():
    func_scores = {f.replace("score_",""):r[f] for f in SCORE_FIELDS if r[f] > 0}
    p(f"  [{r['recommend_score']:3d}] pop={r['popularity_score']:3d}  {r['name_jp'][:30]}")
    p(f"       tags: {r['tags_jp'][:60]}")
    p(f"       func: {func_scores}")

# -----------------------------------------------------------------------
# 5. popularity_score と commercial_products の相関確認
# -----------------------------------------------------------------------
h("5. popularity_score ↔ commercial_products 相関")
df_pop = df[df["commercial_products"].str.strip() != ""].copy()
df_pop["_cp_num"] = df_pop["commercial_products"].str.extract(r"([\d,]+)").iloc[:,0].str.replace(",","").astype(float)
corr = df_pop[["_cp_num","popularity_score"]].corr().iloc[0,1]
p(f"Pearson相関係数 (log期待値なので参考): {corr:.4f}")

# 実例確認
p("commercial_products ↔ popularity_score サンプル（件数順）:")
sample = df_pop.nlargest(10, "_cp_num")[["name_jp","commercial_products","popularity_score"]]
for _, r in sample.iterrows():
    p(f"  {r['commercial_products']:15s} → popularity={r['popularity_score']:3d}  {r['name_jp'][:30]}")
p("下位10件:")
sample_low = df_pop.nsmallest(10, "_cp_num")[["name_jp","commercial_products","popularity_score"]]
for _, r in sample_low.iterrows():
    p(f"  {r['commercial_products']:15s} → popularity={r['popularity_score']:3d}  {r['name_jp'][:30]}")

# -----------------------------------------------------------------------
# 6. スコア分布の偏り
# -----------------------------------------------------------------------
h("6. スコア列の分布")
for f in SCORE_FIELDS:
    vals = df[f]
    nz   = vals[vals > 0]
    dist = Counter(vals.tolist())
    unique_nz = set(nz.tolist())
    p(f"{f}:")
    p(f"  非ゼロ {len(nz):,}件  値の種類: {sorted(unique_nz)}  平均(非ゼロ): {nz.mean():.1f}" if len(nz) else "  全0")

p("\npopularity_score 分布 (10刻み):")
bins = [0,1,10,20,30,40,50,60,70,80,90,100]
pop_vals = df["popularity_score"]
for lo, hi in zip(bins, bins[1:]):
    cnt = ((pop_vals >= lo) & (pop_vals < hi)).sum() if hi < 100 else ((pop_vals >= lo) & (pop_vals <= hi)).sum()
    p(f"  {lo:3d}-{hi:3d}: {cnt:,} 件")

p("\nrecommend_score 分布 (10刻み):")
rec_vals = df["recommend_score"]
for lo, hi in zip(bins, bins[1:]):
    cnt = ((rec_vals >= lo) & (rec_vals < hi)).sum() if hi < 100 else ((rec_vals >= lo) & (rec_vals <= hi)).sum()
    p(f"  {lo:3d}-{hi:3d}: {cnt:,} 件")

# -----------------------------------------------------------------------
# 7. 表記ゆれ重複確認
# -----------------------------------------------------------------------
h("7. 表記ゆれ重複確認")
# 名前の完全重複
dup_name = df[df.duplicated("name_jp", keep=False) & (df["name_jp"] != "")]
p(f"name_jp 完全重複: {len(dup_name):,} 件 ({dup_name['name_jp'].nunique()} 種)")
if len(dup_name) > 0:
    for name, grp in list(dup_name.groupby("name_jp"))[:10]:
        p(f"  '{name}': {len(grp)}件")

# INCI重複
dup_inci = df[df.duplicated("name_inci", keep=False) & (df["name_inci"].str.strip() != "")]
p(f"name_inci 完全重複: {len(dup_inci):,} 件 ({dup_inci['name_inci'].nunique()} 種)")

# 先頭25文字が同じグループ（表記ゆれ候補）
df["_name_prefix"] = df["name_jp"].str[:20]
prefix_dup = df[df.duplicated("_name_prefix", keep=False) & (df["_name_prefix"].str.strip() != "")]
p(f"先頭20文字一致（表記ゆれ候補）: {len(prefix_dup):,} 件 ({prefix_dup['_name_prefix'].nunique()} グループ)")
if len(prefix_dup) > 0:
    p("代表例（上位10グループ）:")
    for pref, grp in list(prefix_dup.groupby("_name_prefix"))[:10]:
        p(f"  '{pref}' → {list(grp['name_jp'].values[:3])}")

# -----------------------------------------------------------------------
# 8. purpose 73種類が全てマッピングされたか
# -----------------------------------------------------------------------
h("8. purpose 全トークンのマッピング確認")
# 全purposeトークンを収集
all_purpose_tokens: Counter = Counter()
for row in df["purpose"]:
    for t in re.split(r"[/、，,]", row):
        t = t.strip()
        if t:
            all_purpose_tokens[t] += 1

# タグがない行のpurposeトークン
unmapped_tokens: Counter = Counter()
for _, row in df[df["tags_jp"] == ""].iterrows():
    for t in re.split(r"[/、，,]", row["purpose"]):
        t = t.strip()
        if t:
            unmapped_tokens[t] += 1

p(f"purpose 全ユニークトークン数: {len(all_purpose_tokens)}")
p(f"未マッピングトークン数: {len(unmapped_tokens)}")
p("\n未マッピングトークン一覧（件数つき）:")
for tok, cnt in unmapped_tokens.most_common():
    p(f"  {tok}: {cnt}件")

# -----------------------------------------------------------------------
# 9. 総合品質評価
# -----------------------------------------------------------------------
h("9. 総合品質評価")

tag_coverage = (df["tags_jp"] != "").sum() / total * 100
purpose_has  = (df["purpose"].str.strip() != "").sum()
purpose_unmapped_rate = (has_purpose & no_tag).sum() / purpose_has * 100 if purpose_has else 0
score_coverage = (df[SCORE_FIELDS].max(axis=1) > 0).sum() / total * 100
pop_coverage   = (df["popularity_score"] > 0).sum() / total * 100
suspicious_rate = len(suspicions) / total * 100

p(f"タグカバー率        : {tag_coverage:.1f}%")
p(f"purpose→タグ漏れ率  : {purpose_unmapped_rate:.1f}%")
p(f"機能スコア付与率    : {score_coverage:.1f}%")
p(f"popularity付与率    : {pop_coverage:.1f}%")
p(f"誤分類疑い件数      : {len(suspicions):,}件 ({suspicious_rate:.1f}%)")
p(f"INCI重複数          : {dup_inci['name_inci'].nunique()}グループ")
p(f"未マッピングpurpose : {len(unmapped_tokens)}種")

# 評価
issues = []
if tag_coverage < 95:   issues.append(f"タグカバー率 {tag_coverage:.1f}% < 95%")
if purpose_unmapped_rate > 5: issues.append(f"purpose漏れ {purpose_unmapped_rate:.1f}% > 5%")
if score_coverage < 50: issues.append(f"機能スコア付与率 {score_coverage:.1f}% < 50%")
if len(unmapped_tokens) > 5: issues.append(f"未マッピングpurpose {len(unmapped_tokens)}種あり")
if len(suspicions) > 500: issues.append(f"誤分類疑い {len(suspicions)}件")

if len(issues) == 0:
    grade = "A"
elif len(issues) <= 1:
    grade = "B"
elif len(issues) <= 3:
    grade = "C"
else:
    grade = "D"

p(f"\n★ 総合評価: {grade} 評価")
if issues:
    p("  課題:")
    for i in issues:
        p(f"    - {i}")
else:
    p("  品質基準をすべてクリアしています")

# -----------------------------------------------------------------------
# レポート出力
# -----------------------------------------------------------------------
report = "\n".join(lines)
print(report)
RPT_TXT.write_text(report, encoding="utf-8")
print(f"\n\nレポート保存: {RPT_TXT}")
