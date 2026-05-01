"""
4ファイルを ingredient_name 主軸で統合
→ unified_health_food_db.csv / .json
"""
import csv, json, math
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).parent.parent / "beauty_health_project"

# ---------------------------------------------------------------
# 1. ingredients_master 読み込み
# ---------------------------------------------------------------
print("読み込み中...")
master: dict[str, dict] = {}
with open(ROOT / "ingredients_master.csv", encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        master[r["ingredient_name"]] = r

# ---------------------------------------------------------------
# 2. ingredient_function_map 読み込み
#    同一成分の複数機能を集約
# ---------------------------------------------------------------
func_by_ing: dict[str, dict] = defaultdict(lambda: {
    "function_jp": [], "function_en": [], "function_cn": [],
    "best_rec": 0, "best_pop": 0,
})
with open(ROOT / "ingredient_function_map.csv", encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        nm  = r["ingredient_name"]
        jp  = r["function_tag_jp"]
        en  = r["function_tag_en"]
        cn  = r["function_tag_cn"]
        rec = int(r["recommendation_score"])
        pop = int(r["popularity_score"])
        fb  = func_by_ing[nm]
        if jp and jp not in fb["function_jp"]:
            fb["function_jp"].append(jp)
            fb["function_en"].append(en)
            fb["function_cn"].append(cn)
        fb["best_rec"] = max(fb["best_rec"], rec)
        fb["best_pop"] = max(fb["best_pop"], pop)

# ---------------------------------------------------------------
# 3. products_clean から成分ごとに商品名を収集
# ---------------------------------------------------------------
products_by_ing: dict[str, list[dict]] = defaultdict(list)
seen_products: dict[str, set] = defaultdict(set)   # 重複排除用

with open(ROOT / "products_clean.csv", encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        product_name = r["商品名"].strip()
        company      = r["届出者名"].strip()
        status       = r["販売状況"].strip()
        for nm in r["成分名_正規化"].split("|"):
            nm = nm.strip()
            if not nm:
                continue
            key = f"{product_name}::{company}"
            if key not in seen_products[nm]:
                seen_products[nm].add(key)
                products_by_ing[nm].append({
                    "name":    product_name,
                    "company": company,
                    "status":  status,
                })

# ---------------------------------------------------------------
# 4. 統合レコード生成
# ---------------------------------------------------------------
print("統合中...")
unified: list[dict] = []

all_names = set(master.keys()) | set(func_by_ing.keys())
for nm in all_names:
    m  = master.get(nm, {})
    fb = func_by_ing.get(nm, {})

    # 商品リスト（販売中を先頭に、最大30件）
    prods = products_by_ing.get(nm, [])
    prods_sorted = sorted(prods, key=lambda x: (x["status"] != "販売中", x["name"]))[:30]
    prod_names = [p["name"] for p in prods_sorted]

    # product_count は master 優先、なければ商品リスト件数
    prod_count = int(m.get("product_count", 0)) or len(prods)

    rec  = int(fb.get("best_rec", 0))
    pop  = int(fb.get("best_pop", 0)) or int(m.get("popularity_score", 0))

    # popularity が 0 でも製品数から補完
    if pop == 0 and prod_count > 0:
        p95 = 200  # 推定
        pop = min(100, max(1, round(math.log1p(prod_count) / math.log1p(p95) * 95)))

    unified.append({
        "ingredient_id":          m.get("ingredient_id", ""),
        "ingredient_name":        nm,
        "base_category":          m.get("base_category", ""),
        "function_jp":            "|".join(fb.get("function_jp", [])),
        "function_en":            "|".join(fb.get("function_en", [])),
        "function_cn":            "|".join(fb.get("function_cn", [])),
        "product_count":          prod_count,
        "popularity_score":       pop,
        "recommendation_score":   rec,
        "raw_material_examples":  m.get("raw_material_examples", ""),
        "products":               "|".join(prod_names),
    })

# recommendation_score 降順ソート
unified.sort(key=lambda x: (-x["recommendation_score"], -x["product_count"]))

print(f"  統合件数: {len(unified):,}件")

# ---------------------------------------------------------------
# 5. CSV 出力
# ---------------------------------------------------------------
csv_path = ROOT / "unified_health_food_db.csv"
fields = ["ingredient_id","ingredient_name","base_category",
          "function_jp","function_en","function_cn",
          "product_count","popularity_score","recommendation_score",
          "raw_material_examples","products"]

with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    w.writerows(unified)

print(f"  CSV: {csv_path.name}  ({csv_path.stat().st_size // 1024} KB)")

# ---------------------------------------------------------------
# 6. JSON 出力（サイト側でそのまま使える構造）
# ---------------------------------------------------------------
json_rows = []
for r in unified:
    json_rows.append({
        "id":           r["ingredient_id"],
        "name":         r["ingredient_name"],
        "category":     r["base_category"],
        "functions": {
            "jp": r["function_jp"].split("|") if r["function_jp"] else [],
            "en": r["function_en"].split("|") if r["function_en"] else [],
            "cn": r["function_cn"].split("|") if r["function_cn"] else [],
        },
        "product_count":        r["product_count"],
        "popularity_score":     r["popularity_score"],
        "recommendation_score": r["recommendation_score"],
        "raw_materials":        r["raw_material_examples"],
        "products":             r["products"].split("|") if r["products"] else [],
    })

json_path = ROOT / "unified_health_food_db.json"
with open(json_path, "w", encoding="utf-8") as f:
    json.dump(json_rows, f, ensure_ascii=False, separators=(",", ":"))

print(f"  JSON: {json_path.name}  ({json_path.stat().st_size // 1024} KB)")

# ---------------------------------------------------------------
# サマリー
# ---------------------------------------------------------------
print("\n--- TOP 20 (recommendation_score 順) ---")
for r in unified[:20]:
    print(f"  [{r['recommendation_score']:3d}] pop={r['popularity_score']:3d}  "
          f"prods={r['product_count']:4d}  {r['ingredient_name'][:28]:28s}  "
          f"{r['function_jp'][:40]}")

no_func = [r for r in unified if not r["function_jp"]]
print(f"\n機能タグなし: {len(no_func)}件")
