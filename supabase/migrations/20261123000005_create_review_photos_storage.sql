-- ============================================================================
-- Migration 05: 학식 리뷰 사진 전용 Supabase Storage 버킷 (review-photos)
-- - DB(meal_reviews.photo_url)에는 base64가 아닌 Storage 공개 URL만 저장
-- - 용량 제한: 5MB (5,242,880 bytes)
-- - 허용 형식: image/jpeg, image/png, image/webp, image/gif
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'review-photos',
  'review-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 리뷰 사진 조회: 누구나 가능 (공개 버킷)
create policy "review_photos_select_public"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'review-photos');

-- 리뷰 사진 업로드: review-photos 버킷에 한해 허용 (실제 앱에서는 서버 API 라우트에서만 업로드 호출)
create policy "review_photos_insert_bucket"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'review-photos');

-- 본인 업로드 사진 삭제: 로그인 사용자가 본인이 올린 객체만 삭제 가능
create policy "review_photos_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'review-photos' and (select auth.uid()) = owner);
