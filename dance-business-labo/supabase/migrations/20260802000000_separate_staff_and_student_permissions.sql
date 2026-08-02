-- 権限分離: スタッフ(profiles.role = 'admin')と生徒アカウントを区別する。
--
-- これまでは全テーブルが「ログイン済みなら誰でも全操作可」(using (true)) だったため、
-- 生徒アカウントでログインしたユーザーが、他の生徒の支払い・チケット・個人情報を
-- 読み書きできてしまう状態だった。このアプリが実際に使っている16テーブルに対して、
-- スタッフ専用テーブルはスタッフのみ、生徒向けテーブルはスタッフ全権限＋
-- 生徒本人の行のみ閲覧（一部は自分の予約の作成/取消のみ）に絞る。
--
-- 対象外: このSupabaseプロジェクトを共有している他アプリのテーブル
-- (tickets, works, reservations, discography, financials, lesson_plans,
-- lesson_schedules など)。このアプリのコードから一切参照されていないため、
-- 意図せず他アプリの挙動を壊さないよう今回は触らない。

create or replace function public.is_staff()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.current_student_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from students
  where email = (auth.jwt() ->> 'email')
  limit 1;
$$;

-- --- スタッフ専用（生徒がアクセスする必要のない内部管理データ） ---

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'lesson_types', 'curriculum_items', 'lesson_evaluations', 'lesson_plan_items',
    'lesson_substitutions', 'student_substitutions', 'transactions'
  ])
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists authenticated_all on %I', t);
    execute format('drop policy if exists staff_all on %I', t);
    execute format('create policy staff_all on %I for all to authenticated using (is_staff()) with check (is_staff())', t);
  end loop;
end $$;

-- --- 料金プラン系（生徒も内容の閲覧が必要。作成・変更はスタッフのみ） ---

do $$
declare
  t text;
begin
  for t in select unnest(array['subscription_types', 'ticket_types'])
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists authenticated_all on %I', t);
    execute format('drop policy if exists server_api_access on %I', t);
    execute format('drop policy if exists staff_write on %I', t);
    execute format('drop policy if exists authenticated_read on %I', t);
    execute format('create policy staff_write on %I for all to authenticated using (is_staff()) with check (is_staff())', t);
    execute format('create policy authenticated_read on %I for select to authenticated using (true)', t);
  end loop;
end $$;

-- --- lessons: 生徒は閲覧のみ（予約UIで一覧を見るため）。作成・変更はスタッフのみ ---

alter table lessons enable row level security;
drop policy if exists "allow all" on lessons;
drop policy if exists allow_all on lessons;
drop policy if exists authenticated_all on lessons;
drop policy if exists staff_write on lessons;
drop policy if exists authenticated_read on lessons;
create policy staff_write on lessons for all to authenticated using (is_staff()) with check (is_staff());
create policy authenticated_read on lessons for select to authenticated using (true);

-- --- students: スタッフは全権限。生徒本人は自分の行だけ閲覧・更新可 ---

alter table students enable row level security;
drop policy if exists "allow all" on students;
drop policy if exists allow_all on students;
drop policy if exists authenticated_all on students;
drop policy if exists staff_all on students;
drop policy if exists self_read on students;
drop policy if exists self_update on students;
create policy staff_all on students for all to authenticated using (is_staff()) with check (is_staff());
create policy self_read on students for select to authenticated using (email = (auth.jwt() ->> 'email'));
create policy self_update on students for update to authenticated
  using (email = (auth.jwt() ->> 'email'))
  with check (email = (auth.jwt() ->> 'email'));

-- --- student_tickets / student_payments / student_subscriptions / student_records:
--     スタッフは全権限。生徒本人は自分に紐づく行だけ閲覧可（書き込みはスタッフ経由のAPIのみ） ---

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'student_tickets', 'student_payments', 'student_subscriptions', 'student_records'
  ])
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists authenticated_all on %I', t);
    execute format('drop policy if exists server_api_access on %I', t);
    execute format($p$drop policy if exists "認証済みユーザーは支払い履歴を読み込み可" on %I$p$, t);
    execute format($p$drop policy if exists "認証済みユーザーは支払い情報を編集可" on %I$p$, t);
    execute format($p$drop policy if exists "認証済みユーザーは支払い記録を作成可" on %I$p$, t);
    execute format($p$drop policy if exists "認証済みユーザーは支払い記録を削除可" on %I$p$, t);
    execute format($p$drop policy if exists "認証済みユーザーは月謝情報を編集可" on %I$p$, t);
    execute format($p$drop policy if exists "認証済みユーザーは生徒に月謝を割り当て可" on %I$p$, t);
    execute format($p$drop policy if exists "認証済みユーザーは生徒の月謝を読み込み可" on %I$p$, t);
    execute format($p$drop policy if exists "認証済みユーザーは月謝割り当てを削除可" on %I$p$, t);
    execute format('drop policy if exists staff_all on %I', t);
    execute format('drop policy if exists self_read on %I', t);
    execute format('create policy staff_all on %I for all to authenticated using (is_staff()) with check (is_staff())', t);
    execute format('create policy self_read on %I for select to authenticated using (student_id = current_student_id())', t);
  end loop;
end $$;

-- --- attendance: スタッフは全権限。生徒は自分の出席・予約を閲覧、
--     未来のレッスンに限り自分の分の予約作成／取消のみ可（出席済みへの変更は不可） ---

alter table attendance enable row level security;
drop policy if exists "allow all" on attendance;
drop policy if exists allow_all on attendance;
drop policy if exists authenticated_all on attendance;
drop policy if exists staff_all on attendance;
drop policy if exists self_read on attendance;
drop policy if exists self_reserve on attendance;
drop policy if exists self_cancel on attendance;
create policy staff_all on attendance for all to authenticated using (is_staff()) with check (is_staff());
create policy self_read on attendance for select to authenticated using (student_id = current_student_id());
create policy self_reserve on attendance for insert to authenticated
  with check (
    student_id = current_student_id()
    and exists (select 1 from lessons where id = lesson_id and scheduled_at > now())
  );
create policy self_cancel on attendance for delete to authenticated
  using (
    student_id = current_student_id()
    and exists (select 1 from lessons where id = lesson_id and scheduled_at > now())
  );
