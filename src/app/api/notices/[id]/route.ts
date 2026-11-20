import { NextRequest, NextResponse } from 'next/server';
import { getNoticeDetailFromDB, upsertNoticesToDB } from '@/lib/supabase';
import { scrapeNoticeDetail } from '@/lib/dongseo-crawler';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    // 1. Supabase / 로컬 캐시에서 우선 조회
    let notice = await getNoticeDetailFromDB(id);

    // 2. DB에 본문이 없는 경우에만 동서대 웹사이트에서 직접 상세 본문 스크래핑
    if (!notice || (!notice.contentHtml && !notice.contentText)) {
      const scraped = await scrapeNoticeDetail(id);
      if (scraped) {
        notice = {
          ...(notice || {}),
          ...scraped,
        };

        // DB에 본문 저장 (비동기)
        upsertNoticesToDB([notice]).catch(err =>
          console.error('[Detail Save DB Error]', err)
        );
      }
    }

    if (!notice) {
      return NextResponse.json({ success: false, error: '해당 공지사항을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json(
      { success: true, data: notice },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } }
    );
  } catch (error) {
    console.error('[Notice Detail API Error]', error);
    return NextResponse.json({ success: false, error: '공지사항 본문을 불러오지 못했습니다.' }, { status: 500 });
  }
}
