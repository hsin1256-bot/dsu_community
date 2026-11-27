import { NextRequest, NextResponse } from 'next/server';
import { getNoticeDetailFromDB } from '@/lib/db/notices';
import { scrapeNoticeDetail } from '@/lib/dsu/notice-crawler';

export const dynamic = 'force-dynamic';

/** 공지 상세: DB 조회 우선, 없을 경우 실시간 스크래핑 폴백 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!/^\d{1,12}$/.test(params.id)) {
    return NextResponse.json({ success: false, error: '잘못된 공지 번호입니다.' }, { status: 400 });
  }
  const detailUrl = `https://www.dongseo.ac.kr/kr/index.php?mode=view&idx=${params.id}`;

  try {
    try {
      const notice = await getNoticeDetailFromDB(params.id);
      if (notice) {
        return NextResponse.json(
          { success: true, data: notice },
          { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } }
        );
      }
    } catch (dbErr) {
      console.warn('[Notice detail DB lookup failed, falling back to live scrape]', dbErr);
    }

    // 실시간 상세 스크래핑 폴백
    const detail = await scrapeNoticeDetail(detailUrl);
    if (detail) {
      const liveNotice = {
        id: params.id,
        title: '동서대학교 공지사항',
        category: '학사' as const,
        author: '동서대학교',
        date: new Date().toISOString().slice(0, 10),
        views: 0,
        contentHtml: detail.contentHtml,
        contentText: detail.contentText,
        attachments: detail.attachments,
        url: detailUrl,
        aiStatus: 'done' as const,
        source: 'homepage' as const,
      };
      return NextResponse.json({ success: true, data: liveNotice });
    }

    return NextResponse.json(
      {
        success: false,
        error: '해당 공지사항을 찾을 수 없습니다.',
        url: detailUrl,
      },
      { status: 404 }
    );
  } catch (error) {
    console.error('[Notice Detail API Error]', error);
    return NextResponse.json({ success: false, error: '공지사항 본문을 불러오지 못했습니다.', url: detailUrl }, { status: 500 });
  }
}
