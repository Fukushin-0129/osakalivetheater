-- 20260807010000 は role のデフォルト/降格先を 'user' にしていたが、
-- profiles_role_check 制約は 'admin' / 'teacher' / 'student' しか許可しておらず、
-- そのままでは適用に失敗する（本番では 'student' に読み替えて手動実行済み）。
-- 正しい値で揃える。

alter table profiles alter column role set default 'student';

update profiles
set role = 'student'
where role = 'admin'
  and id not in (
    select id from auth.users where email = 'osakalivetheater@gmail.com'
  );
