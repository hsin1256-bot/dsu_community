import * as cheerio from 'cheerio';
import { Notice, NoticeAttachment, NoticeCategory, SyncableNoticeCategory } from '@/types';
import { sanitizeNoticeHtml } from '@/lib/sanitize';
import { todayKST } from '@/lib/date-kst';
import { DSU_BASE_URL, DSU_USER_AGENT, toAbsoluteUrl } from './common';

/** 게시판 코드 (2026-11 학교 사이트 기준으로 확인) */
export const PCODE_MAP: Record<SyncableNoticeCategory, string> = {
  학사: 'MN2000194',
  모집: 'MN2000197',
  취업: 'job_plus',
  장학: 'MN2000195',
  행사: 'MN2000191',
};

export const SYNCABLE_CATEGORIES = Object.keys(PCODE_MAP) as SyncableNoticeCategory[];

export function isSyncableCategory(c: NoticeCategory | string): c is SyncableNoticeCategory {
  return c in PCODE_MAP;
}

/** 목록의 날짜 표기 정규화 ('15:15' → 오늘(KST), '26.11.20' → 2026-11-20) */
function normalizeListDate(rawDate: string): string {
  const trimmed = (rawDate || '').trim();
  if (/^\d{1,2}:\d{1,2}$/.test(trimmed)) return todayKST();
  const parts = trimmed.replace(/[^\d.-]/g, '').split(/[.-]/).filter(Boolean);
  if (parts.length === 3) {
    const yyyy = parts[0].length === 2 ? `20${parts[0]}` : parts[0];
    return `${yyyy}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  }
  return todayKST();
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': DSU_USER_AGENT },
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} (${url})`);
  return res.text();
}

export interface ScrapeNoticeOptions {
  maxPages?: number;
  minDate?: string;
  targetCount?: number;
}

/**
 * 게시판 목록 크롤링.
 * ⚠️ 실패하면 예외를 던집니다. (예전처럼 목업 데이터를 돌려주면 그대로 DB에 저장되는 문제가 있었음)
 * 상단 고정 '공지' 행은 번호 칸이 숫자가 아니므로 건너뜁니다.
 */
export async function scrapeNoticeList(
  category: SyncableNoticeCategory,
  options: ScrapeNoticeOptions = {}
): Promise<Notice[]> {
  const { maxPages = 1, minDate = '', targetCount } = options;
  const pCode = PCODE_MAP[category];
  const notices: Notice[] = [];

  for (let pg = 1; pg <= maxPages; pg++) {
    const html = await fetchHtml(`${DSU_BASE_URL}/kr/?pCode=${pCode}${pg > 1 ? `&pg=${pg}` : ''}`);
    const $ = cheerio.load(html);
    const rows = $('table tbody tr');
    if (rows.length === 0) break;

    let stop = false;
    rows.each((_, el) => {
      if (stop) return;
      if (targetCount && notices.length >= targetCount) {
        stop = true;
        return;
      }
      const $row = $(el);
      const numText = $row.find('td').first().text().replace(/\s+/g, '');
      if (!/^\d+$/.test(numText)) return; // 상단 고정 공지 / 빈 행

      const date = normalizeListDate($row.find('td.date, td.f-date').text());
      if (minDate && date < minDate) {
        stop = true;
        return;
      }

      const $link = $row.find('td.subject a, td.f-tit a, a[href*="idx="]').first();
      const title = $link.text().replace(/\s+/g, ' ').trim();
      const href = $link.attr('href') || '';
      const idx = new URLSearchParams(href.replace(/^.*\?/, '')).get('idx');
      if (!title || !idx) return;

      notices.push({
        id: idx,
        title,
        category,
        author: $row.find('td.writer, td.f-nm').text().trim() || '동서대학교',
        date,
        views: parseInt($row.find('td.read, td.f-hits, td.hit').text().replace(/[^\d]/g, ''), 10) || 0,
        isPinned: false,
        source: 'homepage',
        url: toAbsoluteUrl(href),
      });
    });
    if (stop) break;
  }

  if (notices.length === 0) {
    throw new Error(`[${category}] 게시판에서 공지를 하나도 파싱하지 못했습니다. (페이지 구조 변경 가능성)`);
  }
  return notices;
}

export interface NoticeDetail {
  contentHtml: string;
  contentText: string;
  attachments: NoticeAttachment[];
  hasImages: boolean;
}

/** 상세 본문 크롤링. 실패하면 예외를 던집니다. */
export async function scrapeNoticeDetail(url: string): Promise<NoticeDetail> {
  const html = await fetchHtml(toAbsoluteUrl(url));
  const $ = cheerio.load(html);

  const $content = $('#boardContents').first().length
    ? $('#boardContents').first()
    : $('.board-view-contents, .board-view-cont').first();
  if (!$content.length) {
    throw new Error(`본문 영역(#boardContents)을 찾지 못했습니다: ${url}`);
  }

  // 이미지·링크 절대경로 + 모바일용 클래스
  $content.find('img').each((_, el) => {
    const $img = $(el);
    const src = $img.attr('src') || $img.attr('data-src') || '';
    if (src) $img.attr('src', toAbsoluteUrl(src));
    $img.addClass('max-w-full h-auto rounded-xl my-3 mx-auto block');
  });
  $content.find('a').each((_, el) => {
    const $a = $(el);
    const href = $a.attr('href') || '';
    if (href && !/^(https?:|mailto:|tel:|#)/.test(href)) $a.attr('href', toAbsoluteUrl(href));
  });
  $content.find('table').addClass('w-full border-collapse my-3 text-xs');

  // 첨부파일: <ul class="board-view-filelist"><li><a href="...mode=fdn...">파일명.pdf (126.71 KB)</a>
  const attachments: NoticeAttachment[] = [];
  $('.board-view-filelist a, .file_list a').each((_, a) => {
    const $a = $(a);
    const href = $a.attr('href') || '';
    const label = $a.text().replace(/\s+/g, ' ').trim();
    if (!href || !label || href.startsWith('javascript:')) return;
    const sizeMatch = label.match(/\(([\d.,]+\s*[KMG]?B)\)\s*$/i);
    attachments.push({
      name: sizeMatch ? label.slice(0, sizeMatch.index).trim() : label,
      url: toAbsoluteUrl(href),
      size: sizeMatch?.[1],
    });
  });

  const hasImages = $content.find('img').length > 0;
  return {
    contentHtml: sanitizeNoticeHtml($content.html() || ''),
    contentText: $content.text().replace(/\s+/g, ' ').trim(),
    attachments,
    hasImages,
  };
}
