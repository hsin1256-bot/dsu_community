-- ============================================================================
-- Migration 07: 리뷰·신고·사진 쓰기를 서버(API 라우트, service_role) 전용으로 전환
--
-- 이유
--   anon key 는 브라우저에 공개되므로, anon/authenticated 에 INSERT 를 열어 두면
--   누구나 API 검증(글자 수, 메뉴 존재, 사진 주소, 사용자 정보)을 건너뛰고
--   PostgREST / Storage 에 직접 쓸 수 있습니다.
--   → 생성은 서버가 검증 후 service_role 로만 하고,
--     본인 리뷰 수정/삭제만 사용자 토큰 + RLS 로 허용합니다.
-- ============================================================================

-- 1. meal_reviews ------------------------------------------------------------
drop policy if exists "meal_reviews_insert_anon_prelogin" on public.meal_reviews;
drop policy if exists "meal_reviews_insert_authenticated_dongseo" on public.meal_reviews;
drop policy if exists "meal_reviews_insert_public" on public.meal_reviews;

revoke insert, update, delete, truncate, references, trigger on table public.meal_reviews from anon;
revoke insert, update, truncate, references, trigger on table public.meal_reviews from authenticated;
-- 로그인 사용자는 본인 글의 별점/내용만 수정 가능 (user_id, reported, photo_url 등은 변경 불가)
grant update (rating, comment) on table public.meal_reviews to authenticated;
grant delete on table public.meal_reviews to authenticated;

-- DB 레벨 입력 길이 제한 (API 와 동일)
alter table public.meal_reviews drop constraint if exists meal_reviews_comment_length;
alter table public.meal_reviews add constraint meal_reviews_comment_length check (length(comment) <= 500);
alter table public.meal_reviews drop constraint if exists meal_reviews_nickname_length;
alter table public.meal_reviews add constraint meal_reviews_nickname_length check (length(nickname) <= 20);
alter table public.meal_reviews drop constraint if exists meal_reviews_menu_name_length;
alter table public.meal_reviews add constraint meal_reviews_menu_name_length check (length(menu_name) <= 100);

-- 2. review_reports ----------------------------------------------------------
drop policy if exists "review_reports_insert_anon" on public.review_reports;
drop policy if exists "review_reports_insert_authenticated" on public.review_reports;
revoke all on table public.review_reports from anon, authenticated;
-- RLS 는 켜 둔 채 정책 없음 = service_role 만 접근

-- 3. Storage: review-photos --------------------------------------------------
-- 업로드는 서버가 파일 내용(매직 바이트) 검사 후 service_role 로만
drop policy if exists "review_photos_insert_bucket" on storage.objects;
-- 공개 버킷은 공개 URL 로 바로 볼 수 있으므로 SELECT 정책은 불필요
-- (정책이 있으면 누구나 버킷의 파일 목록을 나열할 수 있음)
drop policy if exists "review_photos_select_public" on storage.objects;

-- 4. cafeteria_menus: 읽기 전용 ------------------------------------------------
revoke insert, update, delete, truncate, references, trigger on table public.cafeteria_menus from anon, authenticated;
