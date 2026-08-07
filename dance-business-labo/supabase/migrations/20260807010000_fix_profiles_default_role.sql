-- profiles.role のデフォルトが 'admin' になっていたため、新規サインアップした
-- 全員が自動的にダッシュボードのスタッフ権限を持ってしまっていた（生徒アカウントで
-- テスト登録したところ、先生用ダッシュボードに入れてしまったことで発覚）。
--
-- デフォルトを非管理者に変更し、誤って admin になっていた既存の生徒アカウントを
-- 降格する。以後、スタッフにする人は手動で role='admin' に更新する運用とする。

alter table profiles alter column role set default 'user';

update profiles
set role = 'user'
where role = 'admin'
  and id not in (
    select id from auth.users where email = 'osakalivetheater@gmail.com'
  );
