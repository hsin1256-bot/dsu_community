-- ============================================================================
-- Migration 01: 동서대학교 통합 캠퍼스 앱 학식 메뉴 & 리뷰 스키마
-- (4인 팀 협업용 Supabase PostgreSQL 표준 마이그레이션)
-- ============================================================================

-- 1. 학식 메뉴 테이블 (글빌 식당, 스플 식당, 경영 식당 통합 관리)
create table if not exists public.cafeteria_menus (
  id text primary key,
  restaurant text not null,
  category text not null,
  name text not null,
  corner_name text,
  price text not null,
  menu_items text[] not null default '{}',
  calories text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 식당 + 카테고리 + 정렬 순서 조회 최적화 복합 인덱스
create index if not exists idx_cafeteria_menus_restaurant_category
  on public.cafeteria_menus (restaurant, category, sort_order);

-- 2. 학식 메뉴별 리뷰 테이블
create table if not exists public.meal_reviews (
  id text primary key,
  menu_id text not null references public.cafeteria_menus(id) on delete cascade,
  restaurant text not null,
  menu_name text not null,
  nickname text not null default '동서대 학우',
  date text not null,
  student_email_masked text not null default '동서대 재학생',
  rating smallint not null check (rating between 1 and 5),
  comment text not null check (length(trim(comment)) >= 2),
  photo_url text,
  reported boolean not null default false,
  report_reason text,
  created_at timestamptz not null default now()
);

-- 식당/메뉴별 최신 리뷰 조회 및 30일 평점 집계 인덱스
create index if not exists idx_meal_reviews_restaurant_created
  on public.meal_reviews (restaurant, created_at desc);

create index if not exists idx_meal_reviews_menu_id
  on public.meal_reviews (menu_id, created_at desc);

create index if not exists idx_meal_reviews_restaurant_menu_name
  on public.meal_reviews (restaurant, menu_name);

-- 3. Data API 역할 권한 부여 (Supabase 공개 스키마 명시적 GRANT)
grant select on table public.cafeteria_menus to anon, authenticated;
grant select, insert, update on table public.meal_reviews to anon, authenticated;

-- 4. Row Level Security (RLS) 활성화 및 정책 설정
alter table public.cafeteria_menus enable row level security;
alter table public.meal_reviews enable row level security;

-- 메뉴 조회: 모든 사용자(anon, authenticated) 허용
create policy "cafeteria_menus_select_public"
  on public.cafeteria_menus
  for select
  to anon, authenticated
  using (true);

-- 리뷰 조회: 모든 사용자 허용
create policy "meal_reviews_select_public"
  on public.meal_reviews
  for select
  to anon, authenticated
  using (true);

-- 리뷰 작성: 별점(1~5) 및 내용(2자 이상) 검증 후 허용
create policy "meal_reviews_insert_public"
  on public.meal_reviews
  for insert
  to anon, authenticated
  with check (rating between 1 and 5 and length(trim(comment)) >= 2);

-- 리뷰 신고 처리: reported = true 업데이트만 허용
create policy "meal_reviews_update_report"
  on public.meal_reviews
  for update
  to anon, authenticated
  using (reported = false)
  with check (reported = true);
