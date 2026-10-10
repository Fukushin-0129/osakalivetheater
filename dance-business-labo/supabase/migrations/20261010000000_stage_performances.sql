-- 舞台（公演）ごとに出演した生徒・演目/役割・動画リンク・チラシ画像を記録する

create table if not exists stage_performances (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  performed_at date not null,
  venue text,
  flyer_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists stage_performance_participants (
  id uuid primary key default gen_random_uuid(),
  performance_id uuid not null references stage_performances(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  role text,
  created_at timestamptz not null default now(),
  unique (performance_id, student_id)
);

create table if not exists stage_performance_videos (
  id uuid primary key default gen_random_uuid(),
  performance_id uuid not null references stage_performances(id) on delete cascade,
  url text not null,
  label text,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists stage_performance_participants_perf_idx on stage_performance_participants(performance_id);
create index if not exists stage_performance_participants_student_idx on stage_performance_participants(student_id);
create index if not exists stage_performance_videos_perf_idx on stage_performance_videos(performance_id);
create index if not exists stage_performances_performed_at_idx on stage_performances(performed_at);

alter table stage_performances enable row level security;
alter table stage_performance_participants enable row level security;
alter table stage_performance_videos enable row level security;

drop policy if exists staff_all on stage_performances;
create policy staff_all on stage_performances for all to authenticated using (is_staff()) with check (is_staff());

drop policy if exists staff_all on stage_performance_participants;
create policy staff_all on stage_performance_participants for all to authenticated using (is_staff()) with check (is_staff());

drop policy if exists staff_all on stage_performance_videos;
create policy staff_all on stage_performance_videos for all to authenticated using (is_staff()) with check (is_staff());

grant select, insert, update, delete on stage_performances to authenticated;
grant select, insert, update, delete on stage_performance_participants to authenticated;
grant select, insert, update, delete on stage_performance_videos to authenticated;

-- チラシ・プログラム画像用のプライベートストレージバケット
insert into storage.buckets (id, name, public) values ('stage-flyers', 'stage-flyers', false) on conflict (id) do nothing;

create policy "authenticated users can upload flyers" on storage.objects for insert to authenticated with check (bucket_id = 'stage-flyers');
create policy "authenticated users can update flyers" on storage.objects for update to authenticated using (bucket_id = 'stage-flyers');
create policy "authenticated users can read flyers" on storage.objects for select to authenticated using (bucket_id = 'stage-flyers');
create policy "authenticated users can delete flyers" on storage.objects for delete to authenticated using (bucket_id = 'stage-flyers');
