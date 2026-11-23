-- ============================================================================
-- Migration 03: 로그인 연동 대비 meal_reviews 테이블에 user_id 컬럼 추가
-- - 로그인 구현 전: user_id = NULL 허용 (비로그인/게스트 리뷰 호환)
-- - 로그인 구현 후: Supabase Auth (auth.users.id) UUID 자동 저장
-- ============================================================================

alter table public.meal_reviews
  add column if not exists user_id uuid references auth.users(id) on delete set null;

-- 마이페이지 '내 리뷰 관리' 조회용 부분 인덱스 (user_id가 있는 행만 인덱싱)
create index if not exists idx_meal_reviews_user_id_created
  on public.meal_reviews (user_id, created_at desc)
  where user_id is not null;

-- [참고] 추후 팀에서 Supabase Auth 로그인을 필수화할 때 아래 RLS 정책으로 전환 가능:
-- create policy "meal_reviews_delete_own"
--   on public.meal_reviews
--   for delete
--   to authenticated
--   using ((select auth.uid()) = user_id);
