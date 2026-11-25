import { NextRequest, NextResponse } from 'next/server';
import {
  crawlLatestGvMenuImage,
  getGvSyncState,
  syncGvWeeklyMenuToSupabase,
} from '@/lib/gv-menu-sync';

/**
 * GET /api/cafeteria/gv-sync
 * 현재 Supabase에 반영된 글빌 식당 동기화 상태 + 사이트의 최신 이미지 변경 여부 확인
 */
export async function GET() {
  try {
    const state = await getGvSyncState();
    let crawl = null;

    try {
      crawl = await crawlLatestGvMenuImage();
    } catch {
      crawl = { error: '학생생활관 사이트 연결 실패' };
    }

    const hasNewImage = Boolean(
      crawl &&
        'weeklyMenuImageUrl' in crawl &&
        crawl.weeklyMenuImageUrl &&
        crawl.weeklyMenuImageUrl !== state?.lastImageUrl
    );

    return NextResponse.json({
      success: true,
      state,
      crawl,
      hasNewImage,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || '동기화 상태 확인 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cafeteria/gv-sync
 * 학생생활관 사이트 크롤링 -> 이미지 파싱 -> Supabase DB 즉시 업데이트 (텍스트 파일 미사용)
 */
export async function POST(req: NextRequest) {
  try {
    const expectedSecret = process.env.SYNC_SECRET || process.env.CRON_SECRET || '';
    if (expectedSecret) {
      const authHeader = req.headers.get('authorization') || '';
      if (authHeader !== `Bearer ${expectedSecret}`) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
    }

    const { searchParams } = new URL(req.url);
    const force = searchParams.get('force') === 'true';

    const result = await syncGvWeeklyMenuToSupabase({ force });
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || '글빌 식단표 자동 업데이트 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
