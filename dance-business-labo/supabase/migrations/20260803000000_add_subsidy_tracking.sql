-- 自治体の習い事費用助成（吹田市子供の習い事費用助成事業など）への対応。
--
-- 制度の仕組み: 保護者が自治体発行の電子クーポン（このアプリの外、専用アプリ上）で
-- レッスン料の一部を充当し、その相当額は自治体からクーポン運営会社経由で教室に
-- 精算入金される。教室が直接請求するものではないため、決済処理自体は本アプリの
-- 対象外。ただし、どの生徒が対象で、支払いのうちいくらがクーポン充当分か、
-- その入金がまだ市から届いていないかは、教室側で記帳・追跡する必要がある。

-- 生徒がどの助成制度の対象か（複数自治体の制度に将来対応できるよう自由記述にする）
alter table students add column if not exists subsidy_program text;

-- 支払いのうち、自治体クーポンで充当された金額（内訳。amount自体はレッスン料全額のまま）
alter table student_payments add column if not exists subsidy_amount numeric not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'student_payments_subsidy_amount_check'
      and conrelid = 'student_payments'::regclass
  ) then
    alter table student_payments add constraint student_payments_subsidy_amount_check
      check (subsidy_amount >= 0 and subsidy_amount <= amount);
  end if;
end $$;

-- クーポン充当分について、自治体からの精算入金が実際に届いたかどうか
alter table student_payments add column if not exists subsidy_received boolean not null default false;
