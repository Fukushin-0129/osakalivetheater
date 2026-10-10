-- 1つのログインアカウントで複数の生徒（家族）のポータルを閲覧できるようにする

create table if not exists portal_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, student_id)
);

create index if not exists portal_access_user_idx on portal_access(user_id);
create index if not exists portal_access_student_idx on portal_access(student_id);

alter table portal_access enable row level security;
drop policy if exists staff_all on portal_access;
create policy staff_all on portal_access for all to authenticated using (is_staff()) with check (is_staff());

grant select, insert, update, delete on portal_access to authenticated;

-- 生徒のメール・家族グループが変更された際に自動でアクセス権を同期する
create or replace function sync_family_portal_access() returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  if new.family_group is not null then
    insert into portal_access (user_id, student_id)
    select u.id, s2.id
    from students s1
    join auth.users u on u.email = s1.email
    join students s2 on s2.family_group = s1.family_group
    where s1.family_group = new.family_group
    on conflict (user_id, student_id) do nothing;
  elsif new.email is not null then
    insert into portal_access (user_id, student_id)
    select u.id, new.id from auth.users u where u.email = new.email
    on conflict (user_id, student_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists students_sync_portal_access on students;
create trigger students_sync_portal_access
after insert or update of email, family_group on students
for each row execute function sync_family_portal_access();

-- 新しいログインアカウントが作られた際に、メールが一致する生徒（と同じ家族グループの生徒）を自動で紐付ける
create or replace function sync_portal_access_for_new_user() returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  insert into portal_access (user_id, student_id)
  select new.id, s2.id
  from students s1
  join students s2 on s2.family_group = s1.family_group
  where s1.email = new.email and s1.family_group is not null
  on conflict (user_id, student_id) do nothing;

  insert into portal_access (user_id, student_id)
  select new.id, s.id from students s where s.email = new.email
  on conflict (user_id, student_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_sync_portal_access on auth.users;
create trigger on_auth_user_created_sync_portal_access
after insert on auth.users
for each row execute function sync_portal_access_for_new_user();

-- 既存データのバックフィル
insert into portal_access (user_id, student_id)
select u.id, s.id from auth.users u join students s on s.email = u.email
on conflict (user_id, student_id) do nothing;

insert into portal_access (user_id, student_id)
select u.id, s2.id
from students s1
join auth.users u on u.email = s1.email
join students s2 on s2.family_group = s1.family_group
where s1.family_group is not null
on conflict (user_id, student_id) do nothing;
