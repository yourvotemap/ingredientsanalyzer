# 化粧品成分データの配置場所

このディレクトリにスクレイパーで取得したCSVを配置してください。

## カラム構成（cosmeinfo等）

```
id, name_jp, name_inci, component_number, definition, name_cn,
purpose, regulation, cas_rn, organic_value, inorganic_value,
notes, related_materials, commercial_products, external_links
```

| カラム | 用途 | DBフィールド |
|--------|------|-------------|
| `name_jp` | 日本語成分名 | `name` |
| `name_inci` | INCI名 | `inci` |
| `name_cn` | 中国語名 | `nameZh` |
| `definition` | 成分説明 | `detail` |
| `purpose` | 用途（保湿、美白 等） | `tags` + スコア自動付与 |
| `commercial_products` | 使用製品数 or 製品リスト | `usageCount` |

## commercial_products の形式について

スクリプトは以下の形式を自動判別します：
- 数値のみ: `9999` → usageCount = 9999
- セミコロン区切りの製品名リスト: `製品A;製品B;製品C` → usageCount = 3
- パイプ区切り: `製品A|製品B` → usageCount = 2

## 処理コマンド

```sh
npm run data:cosmetics
```

タブ区切り（TSV）も自動対応しています。
