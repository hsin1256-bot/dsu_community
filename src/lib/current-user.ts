import { supabase } from '@/lib/supabase';

/**
 * 앱 전역에서 "현재 사용자" 정보를 일관되게 조회하기 위한 단일 진입점.
 *
 * - 현재(로그인 구현 전): Supabase Auth 세션이 없으면 게스트(id: null) 반환
 * - 추후(로그인 구현 후): Supabase Auth(JWT / 세션)가 연결되면 자동으로
 *   auth.users.id (UUID), email, nickname을 반환하며 다른 파일 수정이 필요 없음
 */
export interface CurrentUser {
  id: string | null; // Supabase auth.users.id (UUID). 비로그인 시 null
  nickname: string;
  email: string | null;
  isAuthenticated: boolean;
}

const GUEST_USER: CurrentUser = {
  id: null,
  nickname: '동서대 익명 학우',
  email: null,
  isAuthenticated: false,
};

/**
 * 현재 로그인한 사용자 정보를 반환합니다.
 * - 클라이언트 컴포넌트: `await getCurrentUser()`
 * - API Route (서버): `await getCurrentUser(req)` (Authorization: Bearer <token> 지원)
 */
export async function getCurrentUser(req?: Request): Promise<CurrentUser> {
  if (!supabase) {
    return GUEST_USER;
  }

  try {
    // 1. 서버(API Route)에서 Authorization Bearer 토큰이 전달된 경우 검증
    const authHeader = req?.headers.get('authorization');
    if (authHeader?.toLowerCase().startsWith('bearer ')) {
      const accessToken = authHeader.slice(7).trim();
      if (accessToken) {
        const { data, error } = await supabase.auth.getUser(accessToken);
        if (!error && data.user) {
          return formatSupabaseUser(data.user);
        }
      }
      return GUEST_USER;
    }

    // 2. 브라우저(클라이언트) 환경에서 현재 Supabase 세션 조회
    if (typeof window !== 'undefined') {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) {
        return formatSupabaseUser(data.user);
      }
    }
  } catch (err) {
    console.warn('[current-user] 사용자 세션 조회 실패, 게스트로 처리:', err);
  }

  return GUEST_USER;
}

/**
 * 클라이언트에서 API 요청 시 Authorization 헤더를 자동 첨부하기 위한 헬퍼
 */
export async function getCurrentAuthHeaders(): Promise<Record<string, string>> {
  if (!supabase || typeof window === 'undefined') {
    return {};
  }
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

function formatSupabaseUser(user: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}): CurrentUser {
  const metaNickname =
    typeof user.user_metadata?.nickname === 'string' && user.user_metadata.nickname.trim()
      ? user.user_metadata.nickname.trim()
      : typeof user.user_metadata?.name === 'string' && user.user_metadata.name.trim()
        ? user.user_metadata.name.trim()
        : null;

  const fallbackNickname = user.email ? user.email.split('@')[0] : '동서대 학우';

  return {
    id: user.id,
    nickname: metaNickname || fallbackNickname,
    email: user.email || null,
    isAuthenticated: true,
  };
}
