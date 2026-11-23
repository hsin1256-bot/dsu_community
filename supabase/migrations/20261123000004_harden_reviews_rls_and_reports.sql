-- ============================================================================
-- Migration 04: 리뷰 보안 정책 강화 & 별도 review_reports 테이블 분리
--
-- 1. 기존 meal_reviews 의 광범위한 UPDATE 정책 제거 (비로그인 수정 취약점 차단)
-- 2. 신고 전용 테이블 public.review_reports 신설 (INSERT 전용, 관리자만 열람/처리)
-- 3. meal_reviews 수정/삭제는 로그인 사용자 본인 글(auth.uid() = user_id)만 허용
-- 4. 로그인(@dongseo.ac.kr) 사용자 INSERT 시 auth.uid() 및 @dongseo.ac.kr 메일 검증
-- ============================================================================

-- 1. 신고 전용 테이블 생성 (원본 meal_reviews 를 직접 수정하지 못하도록 분리)
create table if not exists public.review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id text not null references public.meal_reviews(id) on delete cascade,
  reporter_user_id uuid references auth.users(id) on delete set null,
  reason text not null check (length(trim(reason)) >= 2 and length(reason) <= 500),
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_review_reports_review_id_created
  on public.review_reports (review_id, created_at desc);

create index if not exists idx_review_reports_status_created
  on public.review_reports (status, created_at desc);

-- 동일 로그인 사용자의 중복 신고 방지 부분 유니크 인덱스
create unique index if not exists uq_review_reports_review_reporter
  on public.review_reports (review_id, reporter_user_id)
  where reporter_user_id is not null;

-- 신고 테이블 권한: 클라이언트는 INSERT만 가능 (SELECT/UPDATE/DELETE는 관리자/service_role 전용)
revoke all on table public.review_reports from anon, authenticated;
grant insert on table public.review_reports to anon, authenticated;

alter table public.review_reports enable row level security;

create policy "review_reports_insert_anon"
  on public.review_reports
  for insert
  to anon
  with check (
    reporter_user_id is null
    and status = 'pending'
    and length(trim(reason)) >= 2
  );

create policy "review_reports_insert_authenticated"
  on public.review_reports
  for insert
  to authenticated
  with check (
    (select auth.uid()) = reporter_user_id
    and status = 'pending'
    and length(trim(reason)) >= 2
  );

-- ============================================================================
-- 2. meal_reviews 권한 및 RLS 정책 강화
-- ============================================================================

-- 기존 취약한 신고용 UPDATE 정책 및 광범위한 INSERT 정책 제거
drop policy if exists "meal_reviews_update_report" on public.meal_reviews;
drop policy if exists "meal_reviews_insert_public" on public.meal_reviews;

-- 권한 재정비:
-- - anon: SELECT (+ 로그인 PR 병합 전 임시 INSERT만 허용, UPDATE/DELETE 완전 차단)
-- - authenticated: SELECT, INSERT, UPDATE, DELETE (모두 auth.uid() = user_id RLS로 통제)
revoke update, delete on table public.meal_reviews from anon;
grant select, insert, update, delete on table public.meal_reviews to authenticated;

-- INSERT (로그인 사용자): 본인 user_id + @dongseo.ac.kr 이메일 검증
create policy "meal_reviews_insert_authenticated_dongseo"
  on public.meal_reviews
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and lower(coalesce((select auth.jwt() ->> 'email'), '')) like '%@dongseo.ac.kr'
    and rating between 1 and 5
    and length(trim(comment)) >= 2
    and reported = false
  );

-- INSERT (로그인 기능 PR 병합 전 임시 비로그인 작성 허용 — 로그인 오픈 시 이 정책만 삭제하면 됨)
create policy "meal_reviews_insert_anon_prelogin"
  on public.meal_reviews
  for insert
  to anon
  with check (
    user_id is null
    and rating between 1 and 5
    and length(trim(comment)) >= 2
    and reported = false
  );

-- UPDATE: 로그인한 작성자 본인 글만 수정 가능 (USING + WITH CHECK 모두 검증)
create policy "meal_reviews_update_own"
  on public.meal_reviews
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and rating between 1 and 5
    and length(trim(comment)) >= 2
  );

-- DELETE: 로그인한 작성자 본인 글만 삭제 가능
create policy "meal_reviews_delete_own"
  on public.meal_reviews
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
