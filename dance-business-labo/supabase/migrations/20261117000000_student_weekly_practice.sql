create table public.student_weekly_practice (
  student_id uuid not null references public.students(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  curriculum_item_id uuid not null references public.curriculum_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, week_start, curriculum_item_id)
);

create index student_weekly_practice_curriculum_item_idx
  on public.student_weekly_practice (curriculum_item_id);

alter table public.student_weekly_practice enable row level security;

revoke all on public.student_weekly_practice from public, anon, authenticated;
grant select, insert, delete on public.student_weekly_practice to authenticated;
grant select on public.student_weekly_practice to service_role;

create policy weekly_practice_staff on public.student_weekly_practice
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

notify pgrst, 'reload schema';
