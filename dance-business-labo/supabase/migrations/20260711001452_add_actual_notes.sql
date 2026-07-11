-- 実施メモ機能: lesson_plan_items に actual_notes カラムを追加
-- レッスンで実際に行った内容を記録し、カリキュラムの指導ノート(teaching_notes)にも反映する
ALTER TABLE lesson_plan_items
  ADD COLUMN IF NOT EXISTS actual_notes text;
