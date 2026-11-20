import { NextRequest, NextResponse } from 'next/server';
import { scrapeDongseoNotices } from '@/lib/dongseo-crawler';
import { getNoticesFromDB, upsertNoticesToDB } from '@/lib/supabase';
import { runNoticeSyncPipeline } from '@/lib/notice-pipeline';
import { NoticeCategory } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = (searchParams.get('category') || '전체') as NoticeCategory;
  const query = searchParams.get('q') || '';
  const forceSync = searchParams.get('sync') === 'true';

  try {
    // 1. 강제 동기화 요청인 경우 파이프라인 실행
    if (forceSync) {
      const syncResult = await runNoticeSyncPipeline(category, 10);
      return NextResponse.json({ success: true, synced: syncResult });
    }

    // 2. Supabase DB에서 카테고리별 엄격 조회 (타 카테고리 침범 및 불필요 크롤링 방지)
    const dbNotices = await getNoticesFromDB(category, query);
    return NextResponse.json(
      { success: true, data: dbNotices || [], from: 'db' },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } }
    );
  } catch (error) {
    console.error('[Notices API Error]', error);
    return NextResponse.json({ success: false, error: '공지사항을 불러오는 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
