import { NextRequest, NextResponse } from 'next/server';
import { getNoticeDetailFromDB, upsertNoticesToDB } from '@/lib/supabase';
import { scrapeNoticeDetail } from '@/lib/dongseo-crawler';
import { analyzeNoticeWithAI } from '@/lib/llm-extractor';

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

    // 2. DB에 본문이 없거나 비어있는 경우에만 동서대 웹사이트에서 직접 상세 본문 크롤링 & AI 요약 수행 후 DB 저장
    const hasValidContent = notice && notice.contentText && notice.contentText.length > 20;
    if (!notice || !hasValidContent) {
      const scraped = await scrapeNoticeDetail(id);
      if (scraped) {
        const rawTitle = notice?.rawTitle || scraped.title;
        const rawText = scraped.contentText || '';
        const hasImages = scraped.contentHtml ? scraped.contentHtml.includes('<img') : false;

        // Method A 표준: AI 통합 요약 생성
        const aiResult = await analyzeNoticeWithAI(rawTitle, rawText, hasImages);

        notice = {
          ...(notice || {}),
          ...scraped,
          title: aiResult.cleanTitle,
          rawTitle,
          contentText: aiResult.contentSummary,
          aiSummary: aiResult.summary,
          aiDeadline: aiResult.deadlineDate || undefined,
          aiKeywords: aiResult.keywords,
        };

        // DB에 본문 및 요약 비동기 저장
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
