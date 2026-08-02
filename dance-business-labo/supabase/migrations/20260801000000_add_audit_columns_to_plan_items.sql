-- 計画項目の作成・更新者を記録し、意図しない一括上書きの追跡を可能にする
ALTER TABLE lesson_plan_items
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE lesson_plan_items
  ALTER COLUMN created_by SET DEFAULT auth.uid();
