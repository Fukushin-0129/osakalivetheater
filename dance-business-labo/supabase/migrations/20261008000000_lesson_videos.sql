-- レッスンの様子を記録したYouTube限定公開動画のリンクを、1レッスンにつき複数（運用上は3本程度を想定）登録できるようにする。
create table if not exists lesson_videos (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  url text not null,
  label text,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists lesson_videos_lesson_id_idx on lesson_videos(lesson_id);

alter table lesson_videos enable row level security;
drop policy if exists staff_all on lesson_videos;
create policy staff_all on lesson_videos for all to authenticated using (is_staff()) with check (is_staff());
