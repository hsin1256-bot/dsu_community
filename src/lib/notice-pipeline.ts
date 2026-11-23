/**
 * 공지 동기화 파이프라인 (예약 실행 전용: /api/sync 에서만 호출)
 *
 *   학교 게시판 목록 크롤링
 *     → DB 에 없거나 ai_status 가 pending/failed 인 공지만 골라
 *     → 상세 본문 크롤링 → Gemini 요약 → notices 저장
 *
 * 이미 요약된 공지는 다시 요약하지 않으므로, 새 공지가 없으면 Gemini 호출이 0번입니다.
 */

import { Notice, SyncableNoticeCategory } from '@/types';
import { scrapeNoticeList, scrapeNoticeDetail, SYNCABLE_CATEGORIES } from '@/lib/dsu/notice-crawler';
import { analyzeNoticeWithAI } from '@/lib/llm-extractor';
import { getNoticeSyncState, upsertNotices, updateNoticeViews } from '@/lib/db/notices';

export interface CategorySyncResult {
  category: SyncableNoticeCategory;
  scraped: number;
  processed: number;
  skipped: number;
  failed: number;
  error?: string;
}

const CHUNK_SIZE = 3;

async function syncCategory(category: SyncableNoticeCategory, limit: number): Promise<CategorySyncResult> {
  const result: CategorySyncResult = { category, scraped: 0, processed: 0, skipped: 0, failed: 0 };

  const list = await scrapeNoticeList(category, {
    maxPages: Math.max(1, Math.ceil(limit / 15)),
    targetCount: limit,
  });
  result.scraped = list.length;

  const state = await getNoticeSyncState(list.map((n) => n.id));
  const targets = list.filter((n) => {
    const s = state.get(n.id);
    return !s || s.aiStatus === 'pending' || s.aiStatus === 'failed';
  });
  result.skipped = list.length - targets.length;

  // 이미 요약된 공지는 조회수만 갱신
  await updateNoticeViews(list.filter((n) => !targets.includes(n)).map((n) => ({ id: n.id, views: n.views })));

  const toSave: Notice[] = [];
  for (let i = 0; i < targets.length; i += CHUNK_SIZE) {
    const chunk = targets.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map(async (item) => {
        try {
          const detail = await scrapeNoticeDetail(item.url);
          const ai = await analyzeNoticeWithAI(item.title, detail.contentText, detail.hasImages);
          toSave.push({
            ...item,
            // 같은 글이 여러 게시판에 올라온 경우 처음 저장된 카테고리를 유지
            category: (state.get(item.id)?.category as Notice['category']) || category,
            title: ai.cleanTitle,
            rawTitle: item.title,
            contentHtml: detail.contentHtml,
            contentText: detail.contentText,
            attachments: detail.attachments,
            aiStatus: ai.status,
            aiSummary: ai.summary,
            aiDeadline: ai.deadlineDate || undefined,
            aiKeywords: ai.keywords,
          });
          if (ai.status === 'failed') result.failed++;
          else result.processed++;
        } catch (err) {
          result.failed++;
          console.error(`[notice-sync] ${category} #${item.id} 처리 실패:`, err);
        }
      })
    );
  }

  await upsertNotices(toSave);
  return result;
}

/**
 * @param categories 동기화할 카테고리 (기본: 전체 5개)
 * @param limitPerCategory 카테고리별로 확인할 최신 글 수
 */
export async function runNoticeSync(
  categories: SyncableNoticeCategory[] = SYNCABLE_CATEGORIES,
  limitPerCategory = 15
): Promise<CategorySyncResult[]> {
  const results: CategorySyncResult[] = [];
  // 학교 서버 부담을 줄이기 위해 카테고리는 순서대로 처리
  for (const category of categories) {
    try {
      results.push(await syncCategory(category, limitPerCategory));
    } catch (err) {
      results.push({
        category,
        scraped: 0,
        processed: 0,
        skipped: 0,
        failed: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}
