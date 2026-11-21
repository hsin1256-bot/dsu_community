/**
 * 동서대학교 공지사항 자동 크롤링 & LLM 요약 & Supabase 저장 파이프라인 (Method A 표준 일체화)
 */

import { scrapeDongseoNotices, scrapeNoticeDetail } from './dongseo-crawler';
import { analyzeNoticeWithAI } from './llm-extractor';
import { getNoticeDetailFromDB, upsertNoticesToDB } from './supabase';
import { Notice, NoticeCategory } from '@/types';

export interface SyncResult {
  totalScraped: number;
  newProcessed: number;
  skipped: number;
  processedItems: { id: string; title: string; deadline?: string | null; keywords?: string[] }[];
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runNoticeSyncPipeline(
  category: NoticeCategory = '전체',
  limitCount = 10
): Promise<SyncResult> {
  console.log(`[Pipeline] Starting sync for category: ${category} (limit: ${limitCount})`);

  // 1. 공지사항 최신 목록 크롤링 (상단 고정 '공지' 글은 크롤러 레벨에서 자동 필터링)
  const rawList = await scrapeDongseoNotices(category);
  const targetList = rawList.slice(0, limitCount);
  console.log(`[Pipeline] Fetched ${targetList.length} notices to inspect`);

  let newProcessed = 0;
  let skipped = 0;
  const processedItems: SyncResult['processedItems'] = [];
  const noticesToSave: Partial<Notice>[] = [];

  for (const item of targetList) {
    try {
      // 2. 이미 DB에 요약까지 완료된 공지인지 확인 (Method A 동일 기준: contentText 존재 및 20자 이상)
      const existing = await getNoticeDetailFromDB(item.id);
      if (existing && existing.contentText && existing.contentText.length > 20) {
        skipped++;
        continue;
      }

      console.log(`[Pipeline] Processing new notice: [${item.id}] ${item.title}`);

      // 3. 상세 본문(HTML 및 텍스트) 크롤링
      const detail = await scrapeNoticeDetail(item.id);
      const contentHtml = detail?.contentHtml || existing?.contentHtml || '';
      const rawText = detail?.contentText || existing?.contentText || item.title;
      const hasImages = contentHtml.includes('<img');

      // 4. Gemini를 활용한 통합 AI 요약 (제목 정제 + 3~4줄 불릿 본문 요약)
      const aiResult = await analyzeNoticeWithAI(item.title, rawText, hasImages);

      const completeNotice: Partial<Notice> = {
        ...item,
        title: aiResult.cleanTitle,
        rawTitle: item.title,
        contentHtml,
        contentText: aiResult.contentSummary,
        aiSummary: aiResult.summary,
        aiDeadline: aiResult.deadlineDate || undefined,
        aiKeywords: aiResult.keywords,
        attachments: detail?.attachments || existing?.attachments || [],
        source: 'homepage',
      };

      noticesToSave.push(completeNotice);
      processedItems.push({
        id: item.id,
        title: aiResult.cleanTitle,
        deadline: aiResult.deadlineDate,
        keywords: aiResult.keywords,
      });

      newProcessed++;

      // API Rate Limit 방지를 위한 지연 (연속 호출 시)
      await delay(1000);
    } catch (itemError) {
      console.error(`[Pipeline Item Error] Notice ID: ${item.id}`, itemError);
    }
  }

  // 5. Supabase에 일괄 Upsert (Method A와 동일한 스키마 규격으로 저장)
  if (noticesToSave.length > 0) {
    await upsertNoticesToDB(noticesToSave);
    console.log(`[Pipeline] Successfully saved ${noticesToSave.length} notices to DB`);
  }

  return {
    totalScraped: targetList.length,
    newProcessed,
    skipped,
    processedItems,
  };
}
