-- ============================================================================
-- Migration 06: 글빌 식당 자동 크롤링 동기화 상태 관리 테이블
-- - 매주 금요일(12:00~15:00) 기숙사 식단표 이미지 URL 변경 여부를 감지하여
--   새 이미지가 올라왔을 때만 자동으로 파싱 후 cafeteria_menus 를 갱신
-- ============================================================================

create table if not exists public.cafeteria_sync_state (
  restaurant text primary key,
  source_url text not null,
  last_image_url text,
  period text,
  last_synced_at timestamptz not null default now()
);

-- 조회는 공개 허용, 쓰기는 서버(service_role) 전용
grant select on table public.cafeteria_sync_state to anon, authenticated;

alter table public.cafeteria_sync_state enable row level security;

create policy "cafeteria_sync_state_select_public"
  on public.cafeteria_sync_state
  for select
  to anon, authenticated
  using (true);

insert into public.cafeteria_sync_state (restaurant, source_url, last_image_url, period)
values (
  '글빌 식당',
  'https://uni.dongseo.ac.kr/dormitory/index.php?pCode=MN5000024',
  'https://uni.dongseo.ac.kr/_Data/SiteFiles/dormitory/096a3dacf6f17eb25660bcdc2c37fc61.png',
  '11월 16일(월) ~ 11월 20일(금)'
)
on conflict (restaurant) do update
set
  source_url = excluded.source_url,
  last_image_url = excluded.last_image_url,
  period = excluded.period,
  last_synced_at = now();
