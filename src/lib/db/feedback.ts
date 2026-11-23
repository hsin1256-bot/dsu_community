import { getSupabaseAdmin } from '@/lib/supabase-client';

export const FEEDBACK_CATEGORIES = {
  bug: '버그 제보',
  feature: '기능 제안',
  data_error: '정보 오류 신고',
  other: '기타 문의',
} as const;
export type FeedbackCategory = keyof typeof FEEDBACK_CATEGORIES;

export interface FeedbackInput {
  category: FeedbackCategory;
  message: string;
  contactEmail?: string | null;
  pagePath?: string | null;
  appVersion?: string | null;
  userId?: string | null;
}

/** 피드백 저장 (service role 전용 — DB 에서 anon/authenticated 접근 차단) */
export async function insertFeedback(input: FeedbackInput): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('SUPABASE_SERVICE_ROLE_KEY 가 없어 피드백을 저장할 수 없습니다.');
  const { error } = await admin.from('feedback').insert({
    category: input.category,
    message: input.message,
    contact_email: input.contactEmail || null,
    page_path: input.pagePath || null,
    app_version: input.appVersion || null,
    user_id: input.userId || null,
  });
  if (error) {
    console.error('[feedback] insert error:', error.message);
    throw new Error('피드백 저장에 실패했습니다.');
  }
}
