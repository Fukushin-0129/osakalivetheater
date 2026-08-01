-- Ticket stamp-card system: 4-lesson ticket (5000円) with QR check-in support.

-- Unique QR token per student, used for camera-based attendance check-in.
alter table students add column if not exists qr_token text;
update students set qr_token = replace(gen_random_uuid()::text, '-', '') where qr_token is null;
alter table students alter column qr_token set not null;
create unique index if not exists students_qr_token_key on students (qr_token);

-- Default ticket type matching the paper stamp card: 4 lessons / 5000円, no expiry (long valid_days).
insert into ticket_types (name, total_count, price, valid_days)
select '4回チケット（スタンプカード）', 4, 5000, 3650
where not exists (
  select 1 from ticket_types where name = '4回チケット（スタンプカード）'
);
