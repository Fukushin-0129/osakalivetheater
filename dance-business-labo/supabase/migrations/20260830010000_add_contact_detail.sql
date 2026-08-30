-- 連絡手段の具体的な情報（LINE IDやInstagramアカウント名など）を記録できるようにする。

alter table students add column if not exists contact_detail text;
