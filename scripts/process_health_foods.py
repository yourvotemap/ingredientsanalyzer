"""
機能性表示食品データ整理スクリプト

入力: 機能性表示食品_検索結果一覧.csv (10,840行)
出力:
  ingredients_master.csv     - ユニーク成分マスタ
  function_master.csv        - 標準機能タグマスタ (JP/EN/CN)
  ingredient_function_map.csv - 成分×機能マッピング + スコア
  products_clean.csv         - 撤回除外・整形済み製品データ
"""

import re, csv, json, math
from collections import defaultdict, Counter
from pathlib import Path
import unicodedata

ROOT   = Path(__file__).parent.parent / "beauty_health_project"
IN_CSV = ROOT / "機能性表示食品_検索結果一覧.csv"
OUT    = ROOT

# ============================================================
# 定数定義
# ============================================================

# 機能タグ定義: (キーワードリスト, id, tag_jp, tag_en, tag_cn, desc_jp)
FUNCTION_TAGS: list[tuple[list[str], str, str, str, str, str]] = [
    (["腸内", "腸内フローラ", "腸内環境", "おなかの調子", "便通", "整腸", "排便", "便秘", "軟便"],
     "F01", "腸内環境", "Gut Health", "肠道健康", "腸内環境の改善・便通サポート"),
    (["血糖値", "食後血糖", "血糖", "糖の吸収"],
     "F02", "血糖値", "Blood Sugar", "血糖调节", "食後の血糖値上昇を緩やかに"),
    (["血圧", "高めの血圧"],
     "F03", "血圧", "Blood Pressure", "血压", "正常な血圧の維持サポート"),
    (["中性脂肪", "脂肪の吸収", "脂質"],
     "F04", "中性脂肪", "Triglycerides", "甘油三酯", "血中中性脂肪の低下サポート"),
    (["体脂肪", "内臓脂肪", "腹部脂肪", "ウエスト", "BMI", "肥満", "脂肪の燃焼", "燃焼", "エネルギー代謝"],
     "F05", "体脂肪", "Body Fat", "体脂肪", "体脂肪・内臓脂肪の低減サポート"),
    (["コレステロール", "LDL"],
     "F06", "コレステロール", "Cholesterol", "胆固醇", "LDLコレステロールの低下サポート"),
    (["認知機能", "記憶力", "物忘れ", "認知", "記憶・学習"],
     "F07", "認知機能", "Cognitive Function", "认知功能", "記憶力・認知機能のサポート"),
    (["集中力", "注意力", "判断", "仕事の効率"],
     "F08", "集中力", "Concentration", "专注力", "集中力・注意力のサポート"),
    (["睡眠", "入眠", "眠り", "睡眠の質", "起床時"],
     "F09", "睡眠", "Sleep Quality", "睡眠质量", "睡眠の質の改善サポート"),
    (["リラックス", "ストレス", "精神的ストレス", "緊張"],
     "F10", "リラックス", "Stress Relief", "放松减压", "ストレス・緊張の緩和サポート"),
    (["疲労", "疲れ", "だるさ", "活力", "スタミナ"],
     "F11", "疲労感", "Anti-Fatigue", "抗疲劳", "疲労感の軽減・活力サポート"),
    (["骨", "カルシウム", "骨密度", "骨の健康"],
     "F12", "骨の健康", "Bone Health", "骨骼健康", "骨密度・骨の健康サポート"),
    (["関節", "軟骨", "ひざ", "膝", "関節の動き"],
     "F13", "関節", "Joint Health", "关节健康", "関節・軟骨の健康サポート"),
    (["目", "眼", "視力", "ピント", "ルテイン", "アスタキサンチン", "ブルーライト"],
     "F14", "目の健康", "Eye Health", "眼部健康", "目の健康・視力サポート"),
    (["肌", "皮膚", "潤い", "うるおい", "美容", "素肌", "ハリ", "弾力", "バリア機能", "肌の水分"],
     "F15", "肌の健康", "Skin Health", "皮肤健康", "肌の潤い・ハリのサポート"),
    (["免疫", "感染", "風邪"],
     "F16", "免疫", "Immunity", "免疫力", "免疫機能のサポート"),
    (["抗酸化", "酸化ストレス", "活性酸素"],
     "F17", "抗酸化", "Antioxidant", "抗氧化", "酸化ストレスへの対抗サポート"),
    (["更年期", "ほてり", "のぼせ", "ホットフラッシュ"],
     "F18", "更年期", "Menopause", "更年期", "更年期症状の緩和サポート"),
    (["筋肉", "筋力", "サルコペニア", "運動", "たんぱく質"],
     "F19", "筋肉", "Muscle Health", "肌肉健康", "筋肉量・筋力のサポート"),
    (["血流", "血行", "末梢血流", "冷え", "むくみ", "浮腫"],
     "F20", "血流", "Blood Circulation", "血液循环", "血流・血行のサポート"),
    (["肝臓", "肝機能", "ALT", "AST"],
     "F21", "肝機能", "Liver Health", "肝脏健康", "肝機能のサポート"),
    (["尿酸値", "尿酸", "プリン体"],
     "F22", "尿酸値", "Uric Acid", "尿酸水平", "尿酸値のコントロールサポート"),
    (["口腔", "歯", "歯周", "口臭", "虫歯"],
     "F23", "口腔ケア", "Oral Health", "口腔健康", "口腔内の健康サポート"),
    (["鉄", "貧血", "ヘモグロビン"],
     "F24", "鉄分", "Iron", "铁元素", "鉄分補給・貧血予防サポート"),
    (["育毛", "発毛", "薄毛", "頭皮"],
     "F25", "育毛", "Hair Growth", "育发", "頭皮・発毛のサポート"),
    (["花粉", "アレルギー", "アレルゲン"],
     "F26", "アレルギー", "Allergy Relief", "抗过敏", "アレルギー症状の緩和サポート"),
    (["血管", "動脈硬化", "血管の健康"],
     "F27", "血管の健康", "Vascular Health", "血管健康", "血管の健康・弾力性のサポート"),
    (["葉酸", "妊娠", "胎児", "月経前", "PMS", "晴れない気分"],
     "F28", "妊活・妊娠期", "Pregnancy Support", "备孕", "妊活・妊娠期のサポート"),
]

# 成分カテゴリ基底マッピング
BASE_CATEGORY_MAP: list[tuple[str, str]] = [
    (r"難消化性デキストリン|食物繊維", "食物繊維"),
    (r"乳酸菌|ビフィズス菌|プロバイオティクス|有胞子性乳酸菌|Lactobacillus|Bifidobacterium|Bacillus|Lactococcus|Leuconostoc|Streptococcus|Pediococcus|Heyndrickxia|Limosilactobacillus|Lacticaseibacillus|Ligilactobacillus|Lacticaseibacillus", "乳酸菌・プロバイオティクス"),
    (r"イソフラボン|大豆", "大豆イソフラボン"),
    (r"葛の花", "葛の花"),
    (r"GABA|ギャバ", "GABA"),
    (r"ルテイン|ゼアキサンチン", "ルテイン"),
    (r"DHA|EPA|オメガ3|魚油", "魚油（DHA・EPA）"),
    (r"コラーゲン|ペプチド.*コラーゲン|コラーゲン.*ペプチド", "コラーゲン"),
    (r"ヒアルロン酸", "ヒアルロン酸"),
    (r"セラミド", "セラミド"),
    (r"グルコサミン", "グルコサミン"),
    (r"コンドロイチン", "コンドロイチン"),
    (r"プロテオグリカン", "プロテオグリカン"),
    (r"ヒドロキシチロソール|オリーブ", "オリーブ由来成分"),
    (r"スルフォラファン|ブロッコリー", "スルフォラファン"),
    (r"ロスマリン酸|ローズマリー", "ローズマリー由来成分"),
    (r"コエンザイムQ10|CoQ10|ubiquinol", "コエンザイムQ10"),
    (r"アスタキサンチン", "アスタキサンチン"),
    (r"ケルセチン", "ケルセチン"),
    (r"カテキン|緑茶", "緑茶カテキン"),
    (r"ラクトフェリン", "ラクトフェリン"),
    (r"ナットウキナーゼ|納豆", "ナットウキナーゼ"),
    (r"プラセンタ", "プラセンタ"),
    (r"高麗人参|朝鮮人参|ジンセノサイド", "高麗人参"),
    (r"アシュワガンダ", "アシュワガンダ"),
    (r"シトルリン", "シトルリン"),
    (r"亜鉛", "亜鉛"),
    (r"マグネシウム", "マグネシウム"),
    (r"ビタミンD", "ビタミンD"),
    (r"葉酸", "葉酸"),
    (r"鉄(?!鋼|道|板)", "鉄"),
    (r"カルシウム", "カルシウム"),
    (r"イチョウ葉|フラボノイド配糖体.*イチョウ|テルペンラクトン", "イチョウ葉"),
    (r"ラクチュロース", "ラクチュロース"),
    (r"ヒドロキシクエン酸|ガルシニア", "ガルシニア"),
    (r"フコキサンチン", "フコキサンチン"),
    (r"プロアントシアニジン|プロシアニジン|リンゴ|りんご", "りんご"),
    (r"ブルーベリー|アントシアニン", "ブルーベリー"),
    (r"もろみ酢|黒酢|酢酸", "醸造酢"),
    (r"テアニン|L-テアニン", "テアニン"),
    (r"クロロゲン酸|コーヒー", "コーヒー由来成分"),
    (r"セサミン|ごま|胡麻", "ごま"),
    (r"ポリフェノール|レスベラトロール|ブドウ", "ブドウ由来成分"),
    (r"シルク|フィブロイン", "シルク由来成分"),
    (r"βグルカン|β-グルカン|ベータグルカン", "β-グルカン"),
    (r"大麦|もち麦", "大麦・もち麦"),
    (r"ヒハツ|長胡椒", "ヒハツ"),
    (r"ウコン|クルクミン", "ウコン"),
]

# ============================================================
# ユーティリティ関数
# ============================================================

def normalize_str(s: str) -> str:
    """全角英数字→半角、スペース正規化"""
    s = unicodedata.normalize("NFKC", s)
    return re.sub(r"\s+", " ", s).strip()

def normalize_ingredient_name(raw: str) -> str:
    """機能性関与成分名を正規化（括弧内の学名・別名を保持しつつ短縮）"""
    s = normalize_str(raw)
    # 括弧内が学名 (アルファベット主体) なら除去
    s = re.sub(r"\s*\([A-Za-z][^）\)]*\)", "", s)
    s = re.sub(r"\s*（[A-Za-z][^）\)]*）", "", s)
    # 「として」「含有量として」以降の括弧を除去
    s = re.sub(r"\s*（[^）]*として[^）]*）", "", s)
    s = re.sub(r"\s*\([^)]*として[^)]*\)", "", s)
    # 数字・単位の括弧を除去
    s = re.sub(r"\s*（[\d\.]+[μmg%以上]+.*?）", "", s)
    return s.strip()

def split_ingredients(raw: str) -> list[str]:
    """複数成分を分割（「、」「,」「・」「/」ただし括弧内は除く）"""
    # 括弧内の区切り文字を一時的に置換
    depth = 0
    chars = []
    for ch in raw:
        if ch in "（(":
            depth += 1
        elif ch in "）)":
            depth -= 1
        if depth == 0 and ch in "、，,":
            chars.append("\x00")  # 分割マーカー
        else:
            chars.append(ch)
    parts = "".join(chars).split("\x00")
    return [p.strip() for p in parts if p.strip()]

def get_base_category(name: str) -> str:
    for pat, cat in BASE_CATEGORY_MAP:
        if re.search(pat, name):
            return cat
    # フォールバック: 最初の10文字
    return name.replace("由来", "").replace("含有", "")[:15].strip()

def classify_functions(func_text: str) -> list[str]:
    """機能性テキストから該当する機能タグIDを返す"""
    if not func_text:
        return []
    matched = []
    for (keywords, fid, *_) in FUNCTION_TAGS:
        if any(kw in func_text for kw in keywords):
            matched.append(fid)
    return matched

def to_popularity(count: int, p95: float) -> int:
    if count <= 0:
        return 0
    return min(100, max(1, round(math.log1p(count) / math.log1p(p95) * 95)))

# ============================================================
# STEP 0: 読み込み・撤回除外
# ============================================================
print("=" * 60)
print("STEP 0: 読み込み・撤回除外")
print("=" * 60)

with open(IN_CSV, encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    all_rows = list(reader)

print(f"  総行数: {len(all_rows):,}")
active_rows = [r for r in all_rows if not r["撤回"].strip()]
print(f"  撤回除外後: {len(active_rows):,}件")
print(f"  撤回済み: {len(all_rows) - len(active_rows):,}件")

# ============================================================
# STEP 1: 成分名パース・正規化
# ============================================================
print("\nSTEP 1: 成分名パース・正規化")

# 成分名 → {製品届出番号リスト, 機能IDリスト, 原材料名}
ingredient_products: dict[str, list[str]] = defaultdict(list)
ingredient_functions: dict[str, set] = defaultdict(set)
ingredient_raw_materials: dict[str, set] = defaultdict(set)

# 製品ごとに処理
product_records = []
raw_col = "機能性関与成分を含む原材料名（届出食品が生鮮食品の場合は除く。） "

for i, row in enumerate(active_rows):
    if (i+1) % 2000 == 0:
        print(f"  [{i+1:,}/{len(active_rows):,}] 処理中...")

    届出番号 = row["届出番号"].strip().strip('"')
    raw_ingr  = row["機能性関与成分名"].strip()
    func_text = row["表示しようとする機能性"].strip()
    raw_mat   = row.get(raw_col, "").strip()

    # 成分分割・正規化
    parts = split_ingredients(raw_ingr)
    norm_names = [normalize_ingredient_name(p) for p in parts]
    func_ids = classify_functions(func_text)

    for nm in norm_names:
        if not nm:
            continue
        ingredient_products[nm].append(届出番号)
        ingredient_functions[nm].update(func_ids)
        if raw_mat:
            ingredient_raw_materials[nm].add(raw_mat[:200])

    product_records.append({
        "届出番号": 届出番号,
        "届出日": row["届出日"].strip(),
        "届出者名": row["届出者名"].strip(),
        "商品名": row["商品名"].strip(),
        "食品区分": row["食品の区分"].strip(),
        "販売状況": row["販売状況"].strip(),
        "機能性関与成分名_raw": raw_ingr,
        "成分名_正規化": "|".join(norm_names),
        "機能タグID": "|".join(func_ids),
        "原材料名": raw_mat,
        "摂取目安量": row["一日当たりの摂取目安量"].strip(),
        "含有量": row["一日摂取目安量当たりの機能性関与成分の含有量"].strip(),
        "注意事項": row["摂取をする上での注意事項"].strip()[:200],
    })

print(f"  ユニーク成分名: {len(ingredient_products):,}種")

# ============================================================
# STEP 2: ingredients_master.csv
# ============================================================
print("\nSTEP 2: ingredients_master.csv 生成")

ingredient_counts = {nm: len(prods) for nm, prods in ingredient_products.items()}
p95_count = sorted(ingredient_counts.values())[int(len(ingredient_counts) * 0.95)]

ingredients_master = []
for ing_id, (nm, count) in enumerate(
    sorted(ingredient_counts.items(), key=lambda x: -x[1]), start=1
):
    pop = to_popularity(count, p95_count)
    func_ids = sorted(ingredient_functions[nm])
    raw_mats = list(ingredient_raw_materials[nm])[:3]

    ingredients_master.append({
        "ingredient_id": f"ING-{ing_id:04d}",
        "ingredient_name": nm,
        "base_category": get_base_category(nm),
        "product_count": count,
        "function_ids": "|".join(func_ids),
        "popularity_score": pop,
        "raw_material_examples": " / ".join(raw_mats)[:300],
    })

out_path = OUT / "ingredients_master.csv"
with open(out_path, "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=ingredients_master[0].keys())
    w.writeheader()
    w.writerows(ingredients_master)
print(f"  → {out_path.name} ({len(ingredients_master):,}件)")

# ============================================================
# STEP 3: function_master.csv
# ============================================================
print("\nSTEP 3: function_master.csv 生成")

# 各機能に含まれる製品数を集計
func_product_counter: Counter = Counter()
for prec in product_records:
    for fid in prec["機能タグID"].split("|"):
        if fid:
            func_product_counter[fid] += 1

# 成分ごとの機能数（ingredient → func の逆引き）
func_ingredient_counter: Counter = Counter()
for nm, fids in ingredient_functions.items():
    for fid in fids:
        func_ingredient_counter[fid] += 1

function_master = []
for (keywords, fid, tag_jp, tag_en, tag_cn, desc_jp) in FUNCTION_TAGS:
    prod_cnt = func_product_counter.get(fid, 0)
    ing_cnt  = func_ingredient_counter.get(fid, 0)
    function_master.append({
        "function_id": fid,
        "tag_jp": tag_jp,
        "tag_en": tag_en,
        "tag_cn": tag_cn,
        "description_jp": desc_jp,
        "product_count": prod_cnt,
        "ingredient_count": ing_cnt,
        "keywords": "|".join(keywords),
    })

out_path = OUT / "function_master.csv"
with open(out_path, "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=function_master[0].keys())
    w.writeheader()
    w.writerows(function_master)
print(f"  → {out_path.name} ({len(function_master)}件)")

# 各機能の製品数表示
print("  機能別製品数 top15:")
for (keywords, fid, tag_jp, *_) in sorted(FUNCTION_TAGS, key=lambda x: -func_product_counter.get(x[1], 0))[:15]:
    print(f"    {fid} {tag_jp}: {func_product_counter.get(fid,0):,}製品")

# ============================================================
# STEP 4: ingredient_function_map.csv
# ============================================================
print("\nSTEP 4: ingredient_function_map.csv 生成")

# function_master を辞書化
func_dict = {row["function_id"]: row for row in function_master}
ing_dict  = {row["ingredient_name"]: row for row in ingredients_master}

# 成分 × 機能 の組み合わせで、採用製品数を集計
ing_func_prod_count: dict[tuple, int] = defaultdict(int)
for prec in product_records:
    for nm in prec["成分名_正規化"].split("|"):
        if not nm:
            continue
        for fid in prec["機能タグID"].split("|"):
            if not fid:
                continue
            ing_func_prod_count[(nm, fid)] += 1

# スコア計算
# popularity: 成分の採用製品数ベース
# recommendation: 成分の機能的多様性 + 採用製品数 + 機能の普及度
p95_if = sorted(ing_func_prod_count.values())[int(len(ing_func_prod_count) * 0.95)] if ing_func_prod_count else 1

map_rows = []
for (nm, fid), pair_count in sorted(ing_func_prod_count.items(), key=lambda x: -x[1]):
    ing_row = ing_dict.get(nm, {})
    func_row = func_dict.get(fid, {})

    ing_total_prods = int(ing_row.get("product_count", 0))
    ing_pop = int(ing_row.get("popularity_score", 0))

    # ペア(成分×機能)のpopularity
    pair_pop = to_popularity(pair_count, p95_if)

    # recommendation_score: 成分の総製品普及度60% + ペア固有スコア40%
    rec = round(ing_pop * 0.6 + pair_pop * 0.4)
    rec = max(0, min(100, rec))

    map_rows.append({
        "ingredient_name": nm,
        "ingredient_id": ing_row.get("ingredient_id", ""),
        "base_category": ing_row.get("base_category", ""),
        "function_id": fid,
        "function_tag_jp": func_row.get("tag_jp", ""),
        "function_tag_en": func_row.get("tag_en", ""),
        "function_tag_cn": func_row.get("tag_cn", ""),
        "product_count_pair": pair_count,
        "product_count_ingredient": ing_total_prods,
        "popularity_score": pair_pop,
        "recommendation_score": rec,
    })

out_path = OUT / "ingredient_function_map.csv"
with open(out_path, "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=map_rows[0].keys())
    w.writeheader()
    w.writerows(map_rows)
print(f"  → {out_path.name} ({len(map_rows):,}件)")

print("  recommendation_score 上位20ペア:")
for r in sorted(map_rows, key=lambda x: -x["recommendation_score"])[:20]:
    print(f"    [{r['recommendation_score']:3d}] {r['ingredient_name'][:30]:30s} × {r['function_tag_jp']}")

# ============================================================
# STEP 5: products_clean.csv
# ============================================================
print("\nSTEP 5: products_clean.csv 生成")

# 機能タグIDを日本語タグ名に変換
fid_to_jp = {row["function_id"]: row["tag_jp"] for row in function_master}

for prec in product_records:
    fids = [f for f in prec["機能タグID"].split("|") if f]
    prec["機能タグJP"] = "|".join(fid_to_jp.get(fid, fid) for fid in fids)
    fid_to_en = {row["function_id"]: row["tag_en"] for row in function_master}
    prec["機能タグEN"] = "|".join(fid_to_en.get(fid, fid) for fid in fids)

out_path = OUT / "products_clean.csv"
fields = ["届出番号","届出日","届出者名","商品名","食品区分","販売状況",
          "成分名_正規化","機能タグID","機能タグJP","機能タグEN",
          "原材料名","摂取目安量","含有量","注意事項","機能性関与成分名_raw"]
with open(out_path, "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    w.writerows(product_records)
print(f"  → {out_path.name} ({len(product_records):,}件)")

# ============================================================
# 最終サマリー
# ============================================================
print("\n" + "=" * 60)
print("完了サマリー")
print("=" * 60)
for fname in ["ingredients_master.csv","function_master.csv","ingredient_function_map.csv","products_clean.csv"]:
    p = OUT / fname
    print(f"  {fname}: {p.stat().st_size//1024:,} KB")

print(f"\n  active製品数: {len(product_records):,}")
print(f"  ユニーク成分: {len(ingredients_master):,}種")
print(f"  機能タグ数: {len(function_master)}種")
print(f"  成分×機能ペア: {len(map_rows):,}件")

# 無機能タグ製品の確認
no_func = [p for p in product_records if not p["機能タグID"]]
print(f"  機能タグ未分類製品: {len(no_func):,}件")
if no_func[:3]:
    print("  未分類サンプル:")
    for p in no_func[:3]:
        print(f"    [{p['届出番号']}] {p['商品名'][:30]}: {p['機能性関与成分名_raw'][:50]}")
