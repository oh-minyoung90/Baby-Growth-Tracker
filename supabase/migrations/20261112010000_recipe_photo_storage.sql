-- T-48: 업로드 파일은 브라우저에서 JPEG로 변환한다. 공개 URL과 덮어쓰기는 허용하지 않는다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-photos', 'recipe-photos', false, 20971520, array['image/jpeg'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create function public.owns_recipe_photo_path(path text)
returns boolean language sql stable strict set search_path = ''
as $$
  select split_part(path, '/', 1) = auth.uid()::text and
    path ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.jpg$';
$$;
revoke execute on function public.owns_recipe_photo_path(text) from public, anon;
grant execute on function public.owns_recipe_photo_path(text) to authenticated;
create policy "본인 레시피 사진만 읽기" on storage.objects for select to authenticated
  using (bucket_id = 'recipe-photos' and public.owns_recipe_photo_path(name));
create policy "본인 레시피 사진만 올리기" on storage.objects for insert to authenticated
  with check (bucket_id = 'recipe-photos' and public.owns_recipe_photo_path(name));
create policy "본인 레시피 사진만 삭제" on storage.objects for delete to authenticated
  using (bucket_id = 'recipe-photos' and public.owns_recipe_photo_path(name));
-- UPDATE 정책을 두지 않아 upsert로 기존 사진을 덮어쓸 수 없다. 교체 시 새 UUID를 쓴다.
