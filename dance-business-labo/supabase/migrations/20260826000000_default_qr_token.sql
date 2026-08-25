-- students.qr_token は not null 制約があるが、生徒追加フォームは値を渡しておらず
-- 新規生徒の追加が "null value in column \"qr_token\"" (23502) で失敗していた。
-- DB側でデフォルト生成させ、アプリ側で意識しなくても追加できるようにする。

alter table students
  alter column qr_token set default replace(gen_random_uuid()::text, '-', '');
