-- 計画していたが実際には行わなかった項目を「スキップ」として記録する
ALTER TABLE lesson_plan_items
  ADD COLUMN IF NOT EXISTS skipped boolean DEFAULT false;
