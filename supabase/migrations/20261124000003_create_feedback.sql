-- ============================================================================
-- Migration 08: 문의 및 피드백
--   - 저장은 서버 API(/api/feedback)가 검증 후 service_role 로만 (anon/authenticated 권한 없음)
--   - 조회·처리는 Supabase 대시보드(관리자)에서
--   - IP 등 접속 정보는 저장하지 않음 (도배 방지는 서버에서 처리)
-- ============================================================================
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('bug', 'feature', 'data_error', 'other')),
  message text not null check (length(trim(message)) >= 5 and length(message) <= 2000),
  contact_email text check (contact_email is null or (length(contact_email) <= 100 and contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  page_path text check (page_path is null or length(page_path) <= 200),
  app_version text check (app_version is null or length(app_version) <= 20),
  user_id uuid references auth.users(id) on delete set null,   -- 로그인 기능 연결 후 사용
  status text not null default 'new' check (status in ('new', 'in_progress', 'answered', 'closed')),
  admin_note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_feedback_status_created on public.feedback (status, created_at desc);

revoke all on table public.feedback from anon, authenticated;
alter table public.feedback enable row level security;
-- 정책 없음 = service_role 만 접근
