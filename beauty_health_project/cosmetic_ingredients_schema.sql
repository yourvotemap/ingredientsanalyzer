-- cosmetic_ingredients テーブル定義
-- MySQL版 / PostgreSQL版はコメント参照

CREATE TABLE IF NOT EXISTS cosmetic_ingredients (
  source_id                           INTEGER  -- 元データID (PK候補),
  name_jp                             TEXT  -- 最大 648文字,
  name_inci                           MEDIUMTEXT  -- 最大 1919文字 / PostgreSQL: TEXT,
  component_number                    VARCHAR(12),
  definition                          MEDIUMTEXT,
  name_cn                             TEXT,
  purpose                             VARCHAR(240),
  cas_rn                              VARCHAR(255),
  notes                               MEDIUMTEXT,
  related_materials                   VARCHAR(46),
  commercial_products                 VARCHAR(20),
  external_links                      TEXT,
  tags_jp                             VARCHAR(134)  -- パイプ区切り / PostgreSQL: string_to_array(tags_jp,'|'),
  tags_en                             VARCHAR(255),
  tags_cn                             VARCHAR(96),
  score_moisture                      INTEGER,
  score_barrier                       INTEGER,
  score_brightening                   INTEGER,
  score_acne                          INTEGER,
  score_soothing                      INTEGER,
  score_antioxidant                   INTEGER,
  score_exfoliant                     INTEGER,
  score_uv                            INTEGER,
  score_antiaging                     INTEGER,
  score_hair                          INTEGER,
  popularity_score                    INTEGER,
  recommend_score                     INTEGER  -- 0-100,
  duplicate_group_id                  VARCHAR(16),
  is_duplicate                        TINYINT(1)  -- 0=ユニーク 1=重複あり / PostgreSQL: BOOLEAN
);

-- 推奨インデックス
CREATE INDEX idx_name_jp        ON cosmetic_ingredients (name_jp(100));
CREATE INDEX idx_name_inci      ON cosmetic_ingredients (name_inci(100));
CREATE INDEX idx_recommend      ON cosmetic_ingredients (recommend_score DESC);
CREATE INDEX idx_popularity     ON cosmetic_ingredients (popularity_score DESC);
CREATE INDEX idx_is_duplicate   ON cosmetic_ingredients (is_duplicate);

-- Supabase (PostgreSQL) 用タグ配列化
-- ALTER TABLE cosmetic_ingredients ADD COLUMN tags_jp_arr TEXT[];
-- UPDATE cosmetic_ingredients SET tags_jp_arr = string_to_array(tags_jp, '|');
-- CREATE INDEX idx_tags ON cosmetic_ingredients USING GIN (tags_jp_arr);