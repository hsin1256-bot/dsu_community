import { NextRequest, NextResponse } from 'next/server';
import { getNoticesFromDB, getNoticesByIds } from '@/lib/db/notices';
import { Notice, NoticeCategory } from '@/types';
import { scrapeNoticeList, isSyncableCategory } from '@/lib/dsu/notice-crawler';

export const dynamic = 'force-dynamic';

const CATEGORIES: NoticeCategory[] = ['전체', '학사', '모집', '장학', '취업', '행사'];

// 실시간 크롤링 인메모리 캐시 (학교 서버 과부하 방지: 3분 캐시)
let liveNoticeCache: { timestamp: number; data: Record<string, Notice[]> } = {
  timestamp: 0,
  data: {},
};
const CACHE_TTL_MS = 3 * 60 * 1000;

async function getLiveNotices(category: NoticeCategory): Promise<Notice[]> {
  const now = Date.now();
  if (now - liveNoticeCache.timestamp < CACHE_TTL_MS && liveNoticeCache.data[category]) {
    return liveNoticeCache.data[category];
  }

  const notices: Notice[] = [];

  if (category === '전체') {
    const results = await Promise.allSettled([
      scrapeNoticeList('학사', { maxPages: 1, targetCount: 10 }),
      scrapeNoticeList('모집', { maxPages: 1, targetCount: 8 }),
      scrapeNoticeList('장학', { maxPages: 1, targetCount: 8 }),
      scrapeNoticeList('취업', { maxPages: 1, targetCount: 6 }),
      scrapeNoticeList('행사', { maxPages: 1, targetCount: 6 }),
    ]);

    for (const res of results) {
      if (res.status === 'fulfilled') {
        notices.push(...res.value);
      }
    }
    // 중복 제거 및 날짜 최신순 정렬
    const seen = new Set<string>();
    const unique = notices.filter(n => {
      if (seen.has(n.id)) return false;
      seen.add(n.id);
      return true;
    });
    unique.sort((a, b) => b.date.localeCompare(a.date));
    liveNoticeCache.timestamp = now;
    liveNoticeCache.data['전체'] = unique;
    return unique;
  }

  if (isSyncableCategory(category)) {
    const scraped = await scrapeNoticeList(category, { maxPages: 2, targetCount: 30 });
    scraped.sort((a, b) => b.date.localeCompare(a.date));
    liveNoticeCache.timestamp = now;
    liveNoticeCache.data[category] = scraped;
    return scraped;
  }

  return [];
}

/** 공지 목록: DB 우선 조회 후, DB 미구축/실패/빈 데이터 시 실시간 학교 사이트 크롤링 자동 폴백 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawCategory = searchParams.get('category') || '전체';
  const category = (CATEGORIES.includes(rawCategory as NoticeCategory) ? rawCategory : '전체') as NoticeCategory;
  const query = (searchParams.get('q') || '').slice(0, 50);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10) || 20));

  try {
    // 보관함: ?ids=103573,103706
    const idsParam = searchParams.get('ids');
    if (idsParam !== null) {
      const ids = idsParam.split(',').filter((id) => /^\d{1,12}$/.test(id)).slice(0, 100);
      try {
        const data = await getNoticesByIds(ids);
        if (data.length > 0) {
          return NextResponse.json({ success: true, data, total: data.length, page: 1, pageSize: data.length, totalPages: 1 });
        }
      } catch (e) {
        console.warn('[Notices DB getNoticesByIds failed, falling back to cache]', e);
      }
      // DB 에 없으면 캐시된 공지에서 검색
      const allCached = Object.values(liveNoticeCache.data).flat();
      const matched = allCached.filter(n => ids.includes(n.id));
      return NextResponse.json({ success: true, data: matched, total: matched.length, page: 1, pageSize: matched.length, totalPages: 1 });
    }

    // 1차 시도: Supabase DB 조회
    try {
      const { data, total } = await getNoticesFromDB({ category, query, page, pageSize });
      if (data && data.length > 0) {
        return NextResponse.json(
          { success: true, data, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
          { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
        );
      }
    } catch (dbErr) {
      console.warn('[Notices DB read failed or table missing, falling back to live crawler]', dbErr);
    }

    // 2차 시도: DB 에 데이터가 없거나 테이블이 아직 생성되지 않은 경우 학교 사이트 실시간 크롤링 폴백
    let liveList = await getLiveNotices(category);
    if (query.trim()) {
      const qLower = query.toLowerCase();
      liveList = liveList.filter(
        (n) => n.title.toLowerCase().includes(qLower) || n.author.toLowerCase().includes(qLower)
      );
    }

    const total = liveList.length;
    const from = (page - 1) * pageSize;
    const paged = liveList.slice(from, from + pageSize);

    return NextResponse.json(
      { success: true, data: paged, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
    );
  } catch (error) {
    console.error('[Notices API Error]', error);
    return NextResponse.json({ success: false, error: '공지사항을 불러오는 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
