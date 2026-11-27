import { NextRequest, NextResponse } from 'next/server';
import { getNoticeDetailFromDB } from '@/lib/db/notices';
import { scrapeNoticeDetail } from '@/lib/dsu/notice-crawler';
import * as cheerio from 'cheerio';

export const dynamic = 'force-dynamic';

const PCODE_LIST = ['MN2000194', 'MN2000197', 'MN2000195', 'MN2000191', 'job_plus'];

const CATEGORY_BY_PCODE: Record<string, '학사' | '모집' | '장학' | '행사' | '취업'> = {
  MN2000194: '학사',
  MN2000197: '모집',
  MN2000195: '장학',
  MN2000191: '행사',
  job_plus: '취업',
};

/** 공지 상세: DB 조회 우선, 없을 경우 실시간 스크래핑 폴백 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!/^\d{1,12}$/.test(params.id)) {
    return NextResponse.json({ success: false, error: '잘못된 공지 번호입니다.' }, { status: 400 });
  }

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

    // 실시간 상세 스크래핑 폴백 (게시판 pCode 순회 탐색)
    for (const pCode of PCODE_LIST) {
      const detailUrl = `https://www.dongseo.ac.kr/kr/index.php?pCode=${pCode}&mode=view&idx=${params.id}`;
      try {
        const detail = await scrapeNoticeDetail(detailUrl);
        if (detail && (detail.contentHtml || detail.contentText)) {
          // 본문 HTML 에서 공지 제목 추출
          let noticeTitle = '동서대학교 공지사항';
          try {
            const rawRes = await fetch(detailUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' },
              signal: AbortSignal.timeout(5000),
            });
            if (rawRes.ok) {
              const html = await rawRes.text();
              const $ = cheerio.load(html);
              const pageTitle = $('title').text().trim();
              const cleanTitle = pageTitle ? pageTitle.replace(/^.*?-\s*/, '').replace(/\s*\|.*$/, '').trim() : '';
              if (cleanTitle) {
                noticeTitle = cleanTitle;
              } else {
                const found = $('.board-view-title h3, h3.title, .board-view h3').first().text().trim();
                if (found) noticeTitle = found;
              }
            }
          } catch {
            // ignore title fetch error
          }

          const liveNotice = {
            id: params.id,
            title: noticeTitle,
            category: CATEGORY_BY_PCODE[pCode] || '학사',
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
      } catch {
        // 해당 pCode 에 공지가 없으면 다음 게시판 탐색
        continue;
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: '해당 공지사항을 찾을 수 없습니다.',
        url: `https://www.dongseo.ac.kr/kr/index.php?pCode=MN2000194&mode=view&idx=${params.id}`,
      },
      { status: 404 }
    );
  } catch (error) {
    console.error('[Notice Detail API Error]', error);
    return NextResponse.json(
      { success: false, error: '공지사항 본문을 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}
