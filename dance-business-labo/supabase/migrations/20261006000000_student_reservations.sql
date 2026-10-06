create table if not exists public.student_reservations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  legacy_attendance_id uuid references public.attendance(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint student_reservations_student_lesson_key unique (student_id, lesson_id)
);

alter table public.student_reservations enable row level security;
revoke all on public.student_reservations from anon, authenticated;
grant all on public.student_reservations to service_role;
create index if not exists student_reservations_lesson_id_idx
  on public.student_reservations (lesson_id);
create unique index if not exists student_reservations_legacy_attendance_id_key
  on public.student_reservations (legacy_attendance_id)
  where legacy_attendance_id is not null;

-- Keep future reservations created by the previous portal implementation.
insert into public.student_reservations (student_id, lesson_id, legacy_attendance_id, created_at)
select attendance.student_id, attendance.lesson_id, attendance.id, attendance.created_at
from public.attendance as attendance
join public.lessons as lesson on lesson.id = attendance.lesson_id
where attendance.status = 'present'
  and lesson.scheduled_at > now()
on conflict (student_id, lesson_id) do nothing;

create or replace function public.create_student_lesson_reservation(
  p_student_id uuid,
  p_lesson_id uuid
)
returns public.student_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  lesson_row public.lessons%rowtype;
  reservation_row public.student_reservations%rowtype;
begin
  select * into lesson_row
  from public.lessons
  where id = p_lesson_id
  for update;

  if not found or lesson_row.scheduled_at <= now() then
    raise exception 'LESSON_NOT_FOUND';
  end if;

  if exists (
    select 1 from public.student_reservations
    where student_id = p_student_id and lesson_id = p_lesson_id
  ) then
    raise exception 'ALREADY_RESERVED';
  end if;

  if (
    select count(*)
    from (
      select student_id from public.student_reservations where lesson_id = p_lesson_id
      union
      select student_id from public.attendance
      where lesson_id = p_lesson_id and status in ('present', 'late')
    ) as occupied_seats
  ) >= lesson_row.max_capacity then
    raise exception 'LESSON_FULL';
  end if;

  insert into public.student_reservations (student_id, lesson_id)
  values (p_student_id, p_lesson_id)
  returning * into reservation_row;

  return reservation_row;
end;
$$;

revoke all on function public.create_student_lesson_reservation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_student_lesson_reservation(uuid, uuid) to service_role;

create or replace function public.cancel_student_lesson_reservation(
  p_student_id uuid,
  p_lesson_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  reservation_row public.student_reservations%rowtype;
  lesson_date timestamptz;
begin
  select scheduled_at into lesson_date
  from public.lessons
  where id = p_lesson_id
  for update;

  select * into reservation_row
  from public.student_reservations
  where student_id = p_student_id and lesson_id = p_lesson_id
  for update;

  if not found then
    return;
  end if;

  if lesson_date is null or lesson_date <= now() then
    raise exception 'LESSON_NOT_CANCELLABLE';
  end if;

  if reservation_row.legacy_attendance_id is not null then
    delete from public.attendance
    where id = reservation_row.legacy_attendance_id
      and student_id = p_student_id
      and lesson_id = p_lesson_id;
  end if;

  delete from public.student_reservations where id = reservation_row.id;
end;
$$;

revoke all on function public.cancel_student_lesson_reservation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cancel_student_lesson_reservation(uuid, uuid) to service_role;
