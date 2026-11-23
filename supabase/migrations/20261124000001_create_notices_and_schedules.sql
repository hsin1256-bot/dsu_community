-- ============================================================================
-- Migration 06: 공지사항(notices) + 학사일정(academic_schedules)
--
-- 원칙
--   - 두 테이블 모두 "학교 사이트 크롤링 결과" 이므로 누구나 읽을 수 있고,
--     쓰기는 서버(service_role, /api/sync 예약 실행)만 합니다. → anon/authenticated 쓰기 정책 없음
--   - 날짜는 date 타입 (문자열 비교/like 검색 대신 범위 조회)
--   - 이미 같은 이름의 테이블이 있으면 빠진 칼럼만 추가합니다 (기존 데이터 보존)
-- ============================================================================

-- 1. 공지사항 --------------------------------------------------------------
create table if not exists public.notices (
  id text primary key,                         -- 학교 게시판 글 번호(idx)
  title text not null,                         -- 화면용 정제 제목 (AI)
  raw_title text,                              -- 원본 제목
  category text not null,
  author text,
  date date not null,
  views integer not null default 0,
  url text not null,
  content_html text,                           -- 원문 HTML (sanitize-html 정제 후 저장)
  content_text text,                           -- 원문 텍스트 (요약으로 덮어쓰지 않음)
  attachments jsonb not null default '[]'::jsonb,
  ai_status text not null default 'pending',   -- pending | done | fallback | failed
  ai_summary text[],
  ai_deadline date,
  ai_keywords text[],
  is_pinned boolean not null default false,
  source text not null default 'homepage',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 예전 브랜치에서 만든 notices 테이블이 있을 경우 빠진 칼럼 보충
alter table public.notices add column if not exists raw_title text;
alter table public.notices add column if not exists content_html text;
alter table public.notices add column if not exists content_text text;
alter table public.notices add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.notices add column if not exists ai_status text not null default 'pending';
alter table public.notices add column if not exists ai_summary text[];
alter table public.notices add column if not exists ai_deadline date;
alter table public.notices add column if not exists ai_keywords text[];
alter table public.notices add column if not exists is_pinned boolean not null default false;
alter table public.notices add column if not exists source text not null default 'homepage';
alter table public.notices add column if not exists created_at timestamptz not null default now();
alter table public.notices add column if not exists updated_at timestamptz not null default now();

-- '일반' → '모집' 카테고리 이름 변경 반영
update public.notices set category = '모집' where category = '일반';
-- '전체'는 화면 필터일 뿐 저장 카테고리가 아님 → 학사로 보정 후 다음 동기화에서 재분류
update public.notices set category = '학사' where category = '전체';

alter table public.notices drop constraint if exists notices_category_check;
alter table public.notices add constraint notices_category_check
  check (category in ('학사', '모집', '장학', '취업', '행사'));

alter table public.notices drop constraint if exists notices_ai_status_check;
alter table public.notices add constraint notices_ai_status_check
  check (ai_status in ('pending', 'done', 'fallback', 'failed'));

create index if not exists idx_notices_date on public.notices (date desc, id desc);
create index if not exists idx_notices_category_date on public.notices (category, date desc);
create index if not exists idx_notices_ai_status on public.notices (ai_status) where ai_status in ('pending', 'failed');

-- 2. 학사일정 --------------------------------------------------------------
create table if not exists public.academic_schedules (
  id text primary key,                          -- dsu-<시작일>-<제목+기간 해시>
  title text not null,
  start_date date not null,
  end_date date not null,
  category text not null,
  is_important boolean not null default false,
  last_seen_at timestamptz not null default now(), -- 마지막 동기화에서 학교 사이트에 있었던 시각
  created_at timestamptz not null default now(),
  constraint academic_schedules_date_order check (end_date >= start_date)
);

alter table public.academic_schedules add column if not exists last_seen_at timestamptz not null default now();
alter table public.academic_schedules add column if not exists created_at timestamptz not null default now();

create index if not exists idx_academic_schedules_start on public.academic_schedules (start_date);
create index if not exists idx_academic_schedules_important_end
  on public.academic_schedules (end_date) where is_important;

-- 3. updated_at 자동 갱신 ----------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_notices_updated_at on public.notices;
create trigger trg_notices_updated_at
  before update on public.notices
  for each row execute function public.set_updated_at();

-- 4. 권한 / RLS: 읽기만 공개, 쓰기는 service_role 전용 -------------------------
revoke insert, update, delete, truncate, references, trigger on table public.notices from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.academic_schedules from anon, authenticated;
grant select on table public.notices to anon, authenticated;
grant select on table public.academic_schedules to anon, authenticated;

alter table public.notices enable row level security;
alter table public.academic_schedules enable row level security;

-- 예전 supabase_schema.sql 의 "누구나 쓰기" 정책 제거
drop policy if exists "Allow public upsert access for schedules" on public.academic_schedules;
drop policy if exists "Allow public read access for schedules" on public.academic_schedules;

drop policy if exists "notices_select_public" on public.notices;
create policy "notices_select_public"
  on public.notices for select
  to anon, authenticated
  using (true);

drop policy if exists "academic_schedules_select_public" on public.academic_schedules;
create policy "academic_schedules_select_public"
  on public.academic_schedules for select
  to anon, authenticated
  using (true);
