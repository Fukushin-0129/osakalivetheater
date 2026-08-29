-- 休会中の生徒に連絡する際、何の手段（LINE・Instagram・メールなど）で連絡しているか、
-- その連絡が通じているかを生徒管理で管理できるようにする。

alter table students add column if not exists contact_method text;
alter table students add column if not exists contact_unreachable boolean not null default false;
