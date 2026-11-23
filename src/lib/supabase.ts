/**
 * 서버 전용 DB 접근 함수 모음 (기존 `@/lib/supabase` import 경로 호환용).
 * - 클라이언트 컴포넌트에서는 `@/lib/supabase-client` 만 import 하세요.
 * - 기능별 구현: db/notices.ts(공지), db/cafeteria.ts(학식), db/schedules.ts(학사일정)
 */
export { supabase, isSupabaseConfigured, getSupabaseAdmin } from './supabase-client';
export * from './db/notices';
export * from './db/cafeteria';
export * from './db/schedules';
