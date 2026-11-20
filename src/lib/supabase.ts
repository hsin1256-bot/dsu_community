import { createClient } from '@supabase/supabase-js';
import { MealReview, Notice, NoticeCategory } from '@/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'your_supabase_project_url' &&
  !supabaseUrl.includes('example.com')
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// 로컬 인메모리 공지사항 저장소 (Supabase 미설정 시 폴백)
let localNoticesCache: Notice[] = [];

// DB 레코드 -> Notice 객체 매퍼
function mapRowToNotice(row: any): Notice {
  return {
    id: String(row.id),
    title: row.title,
    rawTitle: row.raw_title,
    category: row.category as NoticeCategory,
    author: row.author || '동서대학교',
    date: row.date,
    views: Number(row.views) || 0,
    url: row.url,
    contentHtml: row.content_html || row.contentHtml,
    contentText: row.content_text || row.contentText,
    aiSummary: row.ai_summary || row.aiSummary || [],
    aiDeadline: row.ai_deadline || row.aiDeadline,
    aiKeywords: row.ai_keywords || row.aiKeywords || [],
    attachments: row.attachments || [],
    isPinned: Boolean(row.is_pinned ?? row.isPinned),
    source: row.source || 'homepage',
  };
}

// Notice 객체 -> DB 컬럼 레코드 매퍼
function mapNoticeToRow(notice: Partial<Notice>): any {
  return {
    id: notice.id,
    title: notice.title,
    category: notice.category,
    author: notice.author,
    date: notice.date,
    views: notice.views || 0,
    url: notice.url,
    content_html: notice.contentHtml,
    content_text: notice.contentText,
    ai_summary: notice.aiSummary || [],
    ai_deadline: notice.aiDeadline || null,
    ai_keywords: notice.aiKeywords || [],
    attachments: notice.attachments || [],
    is_pinned: notice.isPinned ?? false,
    source: notice.source || 'homepage',
  };
}

// 1. 공지사항 목록 조회 (Supabase 1순위 -> 로컬 캐시 2순위)
export async function getNoticesFromDB(category?: NoticeCategory, query?: string): Promise<Notice[] | null> {
  if (isSupabaseConfigured && supabase) {
    try {
      let qb = supabase
        .from('notices')
        .select('*')
        .order('date', { ascending: false })
        .order('id', { ascending: false });

      if (category && category !== '전체') {
        qb = qb.eq('category', category);
      }

      if (query && query.trim()) {
        qb = qb.ilike('title', `%${query.trim()}%`);
      }

      const { data, error } = await qb;
      if (!error && data) {
        return data.map(mapRowToNotice);
      }
      if (error) {
        console.warn('[Supabase getNotices error]', error.message);
      }
    } catch (e) {
      console.warn('[Supabase getNotices exception]', e);
    }
  }

  // Supabase에 데이터가 없거나 미설정 시 로컬 캐시 확인
  if (localNoticesCache.length > 0) {
    let filtered = [...localNoticesCache];
    filtered.sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return Number(b.id) - Number(a.id);
    });
    if (category && category !== '전체') {
      filtered = filtered.filter(n => n.category === category);
    }
    if (query && query.trim()) {
      const qLower = query.toLowerCase();
      filtered = filtered.filter(n => n.title.toLowerCase().includes(qLower));
    }
    return filtered;
  }

  return null;
}

// 2. 공지사항 상세 조회
export async function getNoticeDetailFromDB(id: string): Promise<Notice | null> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('notices')
        .select('*')
        .eq('id', id)
        .single();

      if (!error && data) {
        return mapRowToNotice(data);
      }
    } catch (e) {
      console.warn('[Supabase getNoticeDetail error]', e);
    }
  }

  const foundLocal = localNoticesCache.find(n => n.id === id);
  return foundLocal || null;
}

// 3. 공지사항 일괄 Upsert 저장
export async function upsertNoticesToDB(notices: Partial<Notice>[]): Promise<number> {
  if (!notices.length) return 0;

  // 로컬 캐시 갱신
  for (const n of notices) {
    const existingIdx = localNoticesCache.findIndex(item => item.id === n.id);
    if (existingIdx >= 0) {
      localNoticesCache[existingIdx] = { ...localNoticesCache[existingIdx], ...n } as Notice;
    } else {
      localNoticesCache.unshift(n as Notice);
    }
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const rows = notices.map(mapNoticeToRow);
      const { data, error } = await supabase
        .from('notices')
        .upsert(rows, { onConflict: 'id' })
        .select('id');

      if (!error && data) {
        return data.length;
      }
      if (error) {
        console.error('[Supabase upsert error]', error);
      }
    } catch (e) {
      console.warn('[Supabase upsert exception]', e);
    }
  }

  return notices.length;
}

// 로컬 인메모리 리뷰 저장소 (Supabase 키가 설정되지 않았을 때 폴백)
let localReviews: MealReview[] = [
  {
    id: 'rev-1',
    menuId: 'caf-1',
    restaurant: '학생식당',
    date: '2026-09-27',
    studentEmailMasked: 'kim***@dongseo.ac.kr',
    rating: 5,
    comment: '돈까스 바삭하고 소스도 진해서 오늘 완전 최고였습니다! 가성비 짱',
    createdAt: '2026-09-27T12:30:00Z',
  },
  {
    id: 'rev-2',
    menuId: 'caf-1',
    restaurant: '학생식당',
    date: '2026-09-27',
    studentEmailMasked: 'lee***@dongseo.ac.kr',
    rating: 4,
    comment: '미니 우동 국물이 조금 짰지만 돈까스는 매우 만족스러웠어요.',
    createdAt: '2026-09-27T12:45:00Z',
  },
  {
    id: 'rev-3',
    menuId: 'caf-2',
    restaurant: '학생식당',
    date: '2026-09-27',
    studentEmailMasked: 'park***@dongseo.ac.kr',
    rating: 4,
    comment: '김치찌개 고기 듬뿍 들어있어서 든든하게 먹었습니다.',
    createdAt: '2026-09-27T13:10:00Z',
  }
];

export async function getMealReviews(menuId?: string, restaurant?: string): Promise<MealReview[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase.from('meal_reviews').select('*').order('created_at', { ascending: false });
      if (menuId) query = query.eq('menu_id', menuId);
      if (restaurant) query = query.eq('restaurant', restaurant);
      const { data, error } = await query;
      if (!error && data) {
        return data as MealReview[];
      }
    } catch (e) {
      console.warn('Supabase fetch failed, using local reviews', e);
    }
  }

  // 폴백 반환
  let filtered = [...localReviews];
  if (menuId) filtered = filtered.filter(r => r.menuId === menuId);
  if (restaurant) filtered = filtered.filter(r => r.restaurant === restaurant);
  return filtered;
}

export async function addMealReview(review: Omit<MealReview, 'id' | 'createdAt'>): Promise<MealReview> {
  const newReview: MealReview = {
    ...review,
    id: `rev-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('meal_reviews')
        .insert([newReview])
        .select()
        .single();
      if (!error && data) {
        return data as MealReview;
      }
    } catch (e) {
      console.warn('Supabase insert failed, storing locally', e);
    }
  }

  localReviews.unshift(newReview);
  return newReview;
}
