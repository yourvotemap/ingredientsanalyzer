-- 化粧品：製品での使用頻度カウント
ALTER TABLE "Ingredient" ADD COLUMN "usageCount" INTEGER NOT NULL DEFAULT 0;

-- 健康食品：大本の素材分類（例: りんご、乳酸菌）
ALTER TABLE "Ingredient" ADD COLUMN "baseIngredient" TEXT;

-- インデックス追加
CREATE INDEX "Ingredient_usageCount_idx" ON "Ingredient"("usageCount");
CREATE INDEX "Ingredient_baseIngredient_idx" ON "Ingredient"("baseIngredient");
