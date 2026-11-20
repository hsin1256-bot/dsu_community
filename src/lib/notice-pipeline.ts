/**
 * 동서대학교 공지사항 자동 크롤링 & LLM 요약 & Supabase 저장 파이프라인
 */

import { scrapeDongseoNotices, scrapeNoticeDetail } from './dongseo-crawler';
import { extractNoticeWithLLM } from './llm-extractor';
import { getNoticeDetailFromDB, upsertNoticesToDB } from './supabase';
import { Notice, NoticeCategory } from '@/types';

export interface SyncResult {
  totalScraped: number;
  newProcessed: number;
  skipped: number;
  processedItems: { id: string; title: string; deadline?: string | null; keywords?: string[] }[];
}

export async function runNoticeSyncPipeline(
  category: NoticeCategory = '전체',
  limitCount = 10
): Promise<SyncResult> {
  console.log(`[Pipeline] Starting sync for category: ${category}`);

  // 1. 공지사항 최신 목록 크롤링
  const rawList = await scrapeDongseoNotices(category);
  const targetList = rawList.slice(0, limitCount);
  console.log(`[Pipeline] Fetched ${targetList.length} notices to inspect`);

  let newProcessed = 0;
  let skipped = 0;
  const processedItems: SyncResult['processedItems'] = [];
  const noticesToSave: Partial<Notice>[] = [];

  for (const item of targetList) {
    try {
      // 2. 이미 DB에 요약까지 완료된 공지인지 확인 (중복 비용 및 시간 절약)
      const existing = await getNoticeDetailFromDB(item.id);
      if (existing && existing.aiSummary && existing.aiSummary.length > 0 && existing.contentHtml) {
        skipped++;
        continue;
      }

      console.log(`[Pipeline] Processing new notice: [${item.id}] ${item.title}`);

      // 3. 상세 본문(HTML 및 텍스트) 및 첨부파일 크롤링
      const detail = await scrapeNoticeDetail(item.id);
      const contentHtml = detail?.contentHtml || existing?.contentHtml || '';
      const contentText = detail?.contentText || existing?.contentText || item.title;
      const attachments = detail?.attachments || existing?.attachments || [];

      // 4. LLM을 활용한 구조화 분석 (요약 3줄, 마감일, 키워드 태그)
      const aiResult = await extractNoticeWithLLM(item.title, contentText);

      const completeNotice: Partial<Notice> = {
        ...item,
        contentHtml,
        contentText,
        attachments,
        aiSummary: aiResult.summary,
        aiDeadline: aiResult.deadlineDate || undefined,
        aiKeywords: aiResult.keywords,
        source: 'homepage',
      };

      noticesToSave.push(completeNotice);
      processedItems.push({
        id: item.id,
        title: item.title,
        deadline: aiResult.deadlineDate,
        keywords: aiResult.keywords,
      });

      newProcessed++;
    } catch (itemError) {
      console.error(`[Pipeline Item Error] Notice ID: ${item.id}`, itemError);
    }
  }

  // 5. Supabase에 일괄 Upsert
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
