-- 「連絡が通じているか」を真偽値ではなく反応レベル（0=連絡先不明 / 1=無反応 / 2=やや反応 / 3=反応あり）で
-- 管理できるようにする。既存の contact_unreachable=true は「1=無反応」として引き継ぐ。

alter table students add column if not exists contact_response_level smallint;

update students set contact_response_level = 1
where contact_unreachable = true and contact_response_level is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'students_contact_response_level_check'
  ) then
    alter table students add constraint students_contact_response_level_check
      check (contact_response_level is null or contact_response_level between 0 and 3);
  end if;
end $$;

alter table students drop column if exists contact_unreachable;
