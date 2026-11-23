import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase 클라이언트 단일 진입점.
 *
 * - 이 파일은 클라이언트 컴포넌트에서도 import 될 수 있으므로 fs, sanitize-html 같은
 *   서버 전용 모듈을 절대 import 하지 않습니다.
 * - DB 접근 함수는 `@/lib/db/*` (서버 전용) 에 기능별로 나뉘어 있습니다.
 */

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('http') &&
    !supabaseUrl.includes('your_supabase_project_url') &&
    !supabaseUrl.includes('example.com')
);

/** 공개 조회용 (anon key, RLS 적용) */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * 서버 전용 쓰기 클라이언트 (service role key, RLS 우회).
 * 크롤링 결과 저장(공지·학사일정)에만 사용합니다. 키가 없으면 null 이며,
 * 이 경우 쓰기는 실패로 처리합니다 (anon 으로 폴백하지 않음 → anon 쓰기 정책이 필요 없어짐).
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (typeof window !== 'undefined') return null;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!isSupabaseConfigured || !serviceKey) return null;
  if (!(serviceKey.startsWith('ey') || serviceKey.startsWith('sb_secret_'))) return null;
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** 사용자 JWT 를 붙인 클라이언트 (본인 리뷰 수정/삭제 등 RLS 로 본인 확인) */
export function createAuthedClient(accessToken: string): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
