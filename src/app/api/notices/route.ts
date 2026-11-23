import { NextRequest, NextResponse } from 'next/server';
import { getNoticesFromDB, getNoticesByIds } from '@/lib/db/notices';
import { NoticeCategory } from '@/types';

export const dynamic = 'force-dynamic';

const CATEGORIES: NoticeCategory[] = ['전체', '학사', '모집', '장학', '취업', '행사'];

/** 공지 목록: DB 만 조회 (크롤링/AI 호출 없음). GET /api/notices?category=학사&q=장학&page=1&pageSize=20 */
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
      const data = await getNoticesByIds(ids);
      return NextResponse.json({ success: true, data, total: data.length, page: 1, pageSize: data.length, totalPages: 1 });
    }

    const { data, total } = await getNoticesFromDB({ category, query, page, pageSize });
    return NextResponse.json(
      { success: true, data, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
    );
  } catch (error) {
    console.error('[Notices API Error]', error);
    return NextResponse.json({ success: false, error: '공지사항을 불러오는 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
