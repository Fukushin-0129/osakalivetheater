-- 手動でカリキュラムを追加しても lessons.plan_status が更新されないバグがあったため、
-- 計画項目が存在するのに plan_status が 'planned' になっていない過去のレッスンを一括で修正する。

update lessons
set plan_status = 'planned',
    plan_generated_at = coalesce(plan_generated_at, now())
where plan_status is distinct from 'planned'
  and exists (
    select 1 from lesson_plan_items
    where lesson_plan_items.lesson_id = lessons.id
  );
