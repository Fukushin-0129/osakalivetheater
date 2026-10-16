-- 予約時の事情・ご要望メモと、欠席連絡（先生へのメール内ワンクリック確認）機能

alter table student_reservations add column if not exists note text;

create table if not exists lesson_absence_notices (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  reason text,
  status text not null default 'pending',
  token uuid not null default gen_random_uuid(),
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists lesson_absence_notices_token_idx on lesson_absence_notices(token);
create index if not exists lesson_absence_notices_lesson_idx on lesson_absence_notices(lesson_id);
create index if not exists lesson_absence_notices_student_idx on lesson_absence_notices(student_id);

alter table lesson_absence_notices enable row level security;
drop policy if exists staff_select on lesson_absence_notices;
create policy staff_select on lesson_absence_notices for select to authenticated using (is_staff());

grant select on lesson_absence_notices to authenticated;
