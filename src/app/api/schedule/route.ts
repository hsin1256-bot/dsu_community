import { NextRequest, NextResponse } from 'next/server';
import { getSchedulesByYearRange } from '@/lib/db/schedules';
import { currentYearKST } from '@/lib/date-kst';

export const dynamic = 'force-dynamic';

/**
 * 학사일정 조회: DB 만 읽습니다. (학교 사이트 크롤링은 /api/sync 예약 실행에서만)
 *   GET /api/schedule?from=2025&to=2028   (최대 5년)
 *   GET /api/schedule?year=2026           (기존 호환)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const base = currentYearKST();
  const year = parseInt(searchParams.get('year') || '', 10);
  let from = parseInt(searchParams.get('from') || '', 10) || year || base;
  let to = parseInt(searchParams.get('to') || '', 10) || year || base;
  if (from > to) [from, to] = [to, from];
  if (from < 2000 || to > 2100 || to - from > 4) {
    return NextResponse.json({ success: false, error: '조회 연도 범위가 올바르지 않습니다.', data: [] }, { status: 400 });
  }

  try {
    const { data, syncedAt } = await getSchedulesByYearRange(from, to);
    return NextResponse.json(
      { success: true, data, count: data.length, from, to, syncedAt },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } }
    );
  } catch (err) {
    console.error('[Schedule API Error]', err);
    return NextResponse.json({ success: false, error: '학사일정을 불러오지 못했습니다.', data: [] }, { status: 500 });
  }
}
