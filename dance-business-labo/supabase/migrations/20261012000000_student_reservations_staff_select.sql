-- 先生（管理者）がレッスン一覧で生徒の予約状況を確認できるようにする

drop policy if exists staff_select on student_reservations;
create policy staff_select on student_reservations for select to authenticated using (is_staff());

grant select on student_reservations to authenticated;
