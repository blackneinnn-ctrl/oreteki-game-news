-- 画像アップロード用のバケットを作成
insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do nothing;

-- 誰でも画像を閲覧できるポリシー（SELECT）
create policy "Public Access"
on storage.objects for select
using ( bucket_id = 'images' );

-- 誰でも画像をアップロードできるポリシー（INSERT）
-- ※簡易運用のための設定。本番ではauthenticatedユーザーのみに制限することを推奨。
create policy "Anon Upload Access"
on storage.objects for insert
with check ( bucket_id = 'images' );

-- 誰でも画像を削除できるポリシー（DELETE）
create policy "Anon Delete Access"
on storage.objects for delete
using ( bucket_id = 'images' );
