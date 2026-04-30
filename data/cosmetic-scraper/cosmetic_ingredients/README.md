# 化粧品成分データの配置場所

このディレクトリに以下いずれかの形式でCSV/JSONを配置してください。

## 形式A: 成分ごとの集計済みCSV（推奨）

スクレイパーが「成分ごとに何製品で使われているか」を集計した場合。

```csv
ingredient_name,product_count
グリセリン,8523
水,7841
エタノール,6412
BG,5931
ヒアルロン酸Na,4201
```

## 形式B: 製品ごとのCSV

スクレイパーが製品単位でデータを取得した場合。
`ingredients` 列に「,」区切りで全成分を入れてください。

```csv
product_name,brand,ingredients
モイスチャーローション,〇〇化粧品,"水,グリセリン,BG,ヒアルロン酸Na,カルボマー"
美容液,△△コスメ,"水,BG,ナイアシンアミド,セラミドNP,カルボマー"
```

## 形式C: JSON

```json
[
  { "ingredient_name": "グリセリン", "product_count": 8523 },
  { "ingredient_name": "水", "product_count": 7841 }
]
```

## 処理コマンド

```sh
npx tsx scripts/process-cosmetic-scraper.ts
```
