import { NextRequest, NextResponse } from 'next/server';
import { getNoticeDetailFromDB } from '@/lib/db/notices';

export const dynamic = 'force-dynamic';

/** 공지 상세: DB 만 조회 (크롤링/AI 호출 없음) */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!/^\d{1,12}$/.test(params.id)) {
    return NextResponse.json({ success: false, error: '잘못된 공지 번호입니다.' }, { status: 400 });
  }
  try {
    const notice = await getNoticeDetailFromDB(params.id);
    if (!notice) {
      return NextResponse.json(
        {
          success: false,
          error: '해당 공지사항을 찾을 수 없습니다.',
          url: `https://www.dongseo.ac.kr/kr/index.php?mode=view&idx=${params.id}`,
        },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { success: true, data: notice },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } }
    );
  } catch (error) {
    console.error('[Notice Detail API Error]', error);
    return NextResponse.json({ success: false, error: '공지사항 본문을 불러오지 못했습니다.' }, { status: 500 });
  }
}
