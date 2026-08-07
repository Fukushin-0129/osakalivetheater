-- subscription_types / student_payments / student_subscriptions の3テーブルは、
-- authenticated ロールに REFERENCES / TRIGGER / TRUNCATE しか付与されておらず、
-- SELECT / INSERT / UPDATE / DELETE の基本権限が欠けていた（他13テーブルは正常）。
-- RLSポリシー自体は正しく設定されていても、テーブルレベルのGRANTが無いと
-- 「insufficient_privilege」(42501) で弾かれる。原因不明の欠落（Supabase側の
-- テーブル作成経路の違いによるものと推測）だが、他13テーブルに揃える形で付与する。
grant select, insert, update, delete on subscription_types to authenticated;
grant select, insert, update, delete on student_payments to authenticated;
grant select, insert, update, delete on student_subscriptions to authenticated;
