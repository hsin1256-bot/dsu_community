import { Notice, NoticeAiStatus, NoticeCategory } from '@/types';
import { sanitizeNoticeHtml } from '@/lib/sanitize';
import { supabase, isSupabaseConfigured, getSupabaseAdmin } from '@/lib/supabase-client';

/**
 * notices 테이블 접근 (서버 전용).
 * 컬럼 정의: supabase/migrations/20261124000001_create_notices_and_schedules.sql
 */

type NoticeRow = {
  id: string;
  title: string;
  raw_title: string | null;
  category: string;
  author: string | null;
  date: string;
  views: number | null;
  url: string;
  content_html: string | null;
  content_text: string | null;
  attachments: Notice['attachments'] | null;
  ai_status: NoticeAiStatus | null;
  ai_summary: string[] | null;
  ai_deadline: string | null;
  ai_keywords: string[] | null;
  is_pinned: boolean | null;
  source: Notice['source'] | null;
};

const LIST_COLUMNS = 'id,title,raw_title,category,author,date,views,url,attachments,ai_status,ai_summary,ai_deadline,ai_keywords,is_pinned,source';

function fromRow(row: NoticeRow): Notice {
  return {
    id: String(row.id),
    title: row.title,
    rawTitle: row.raw_title || row.title,
    category: row.category as NoticeCategory,
    author: row.author || '동서대학교',
    date: row.date,
    views: Number(row.views) || 0,
    url: row.url,
    // 저장할 때도 정제하지만, 읽을 때 한 번 더 정제 (과거 데이터 방어)
    contentHtml: row.content_html ? sanitizeNoticeHtml(row.content_html) : undefined,
    contentText: row.content_text || undefined,
    attachments: row.attachments || [],
    aiStatus: row.ai_status || 'pending',
    aiSummary: row.ai_summary || [],
    aiDeadline: row.ai_deadline || undefined,
    aiKeywords: row.ai_keywords || [],
    isPinned: Boolean(row.is_pinned),
    source: row.source || 'homepage',
  };
}

function toRow(n: Notice): NoticeRow {
  return {
    id: String(n.id),
    title: n.title,
    raw_title: n.rawTitle || n.title,
    category: n.category,
    author: n.author || '동서대학교',
    date: n.date,
    views: Number(n.views) || 0,
    url: n.url,
    content_html: n.contentHtml ? sanitizeNoticeHtml(n.contentHtml) : null,
    content_text: n.contentText || null, // 원문 텍스트 (요약은 ai_summary 에 따로 저장)
    attachments: n.attachments || [],
    ai_status: n.aiStatus || 'pending',
    ai_summary: n.aiSummary && n.aiSummary.length ? n.aiSummary : null,
    ai_deadline: n.aiDeadline || null,
    ai_keywords: n.aiKeywords && n.aiKeywords.length ? n.aiKeywords : null,
    is_pinned: Boolean(n.isPinned),
    source: n.source || 'homepage',
  };
}

export interface NoticeListResult {
  data: Notice[];
  total: number;
}

/** 공지 목록 (DB 에서 페이지 단위로 조회) */
export async function getNoticesFromDB(
  options: { category?: NoticeCategory; query?: string; page?: number; pageSize?: number } = {}
): Promise<NoticeListResult> {
  const { category, query, page = 1, pageSize = 20 } = options;
  if (!isSupabaseConfigured || !supabase) return { data: [], total: 0 };

  const from = (Math.max(1, page) - 1) * pageSize;
  let qb = supabase
    .from('notices')
    .select(LIST_COLUMNS, { count: 'exact' })
    .order('date', { ascending: false })
    .order('id', { ascending: false })
    .range(from, from + pageSize - 1);

  if (category && category !== '전체') qb = qb.eq('category', category);
  const q = query?.trim();
  if (q) qb = qb.ilike('title', `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`);

  const { data, error, count } = await qb;
  if (error) {
    console.error('[notices] list error:', error.message);
    throw new Error('공지 목록을 불러오지 못했습니다.');
  }
  return { data: (data as unknown as NoticeRow[]).map(fromRow), total: count ?? 0 };
}

export async function getNoticeDetailFromDB(id: string): Promise<Notice | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.from('notices').select('*').eq('id', id).maybeSingle();
  if (error) {
    console.error('[notices] detail error:', error.message);
    throw new Error('공지를 불러오지 못했습니다.');
  }
  return data ? fromRow(data as NoticeRow) : null;
}

/** 동기화 판단용: id → { category, ai_status } */
export async function getNoticeSyncState(
  ids: string[]
): Promise<Map<string, { category: string; aiStatus: NoticeAiStatus }>> {
  const map = new Map<string, { category: string; aiStatus: NoticeAiStatus }>();
  if (!ids.length || !isSupabaseConfigured || !supabase) return map;
  const { data, error } = await supabase.from('notices').select('id,category,ai_status').in('id', ids);
  if (error) throw new Error(`notices 상태 조회 실패: ${error.message}`);
  for (const r of data || []) map.set(String(r.id), { category: r.category, aiStatus: r.ai_status || 'pending' });
  return map;
}

/** 공지 저장 (service role 전용). 실패하면 예외. */
export async function upsertNotices(notices: Notice[]): Promise<number> {
  if (!notices.length) return 0;
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('SUPABASE_SERVICE_ROLE_KEY 가 없어 공지를 저장할 수 없습니다.');
  const { data, error } = await admin.from('notices').upsert(notices.map(toRow), { onConflict: 'id' }).select('id');
  if (error) throw new Error(`notices 저장 실패: ${error.message}`);
  return data?.length ?? 0;
}

/** 조회수만 갱신 (이미 요약된 공지는 다시 요약하지 않고 숫자만 업데이트) */
export async function updateNoticeViews(items: { id: string; views: number }[]): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin || !items.length) return;
  await Promise.all(items.map((i) => admin.from('notices').update({ views: i.views }).eq('id', i.id)));
}

/** 보관함용: 지정한 id 목록의 공지 */
export async function getNoticesByIds(ids: string[]): Promise<Notice[]> {
  if (!ids.length || !isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('notices')
    .select(LIST_COLUMNS)
    .in('id', ids)
    .order('date', { ascending: false });
  if (error) throw new Error('공지를 불러오지 못했습니다.');
  return (data as unknown as NoticeRow[]).map(fromRow);
}
