'use client';

import { Notice } from '@/types';

const KEYWORDS_STORAGE_KEY = 'dsu_notice_keyword_alerts';
const LAST_CHECKED_KEY = 'dsu_notice_last_checked_timestamp';

// 1. 등록된 알림 키워드 목록 조회
export function getKeywordAlerts(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEYWORDS_STORAGE_KEY);
    if (!raw) {
      // 기본 추천 키워드 초기값
      const defaultKeywords = ['장학금', '수강신청'];
      localStorage.setItem(KEYWORDS_STORAGE_KEY, JSON.stringify(defaultKeywords));
      return defaultKeywords;
    }
    return JSON.parse(raw);
  } catch {
    return ['장학금', '수강신청'];
  }
}

// 2. 새 알림 키워드 추가
export function addKeywordAlert(keyword: string): boolean {
  if (typeof window === 'undefined') return false;
  const trimmed = keyword.trim();
  if (!trimmed) return false;

  const current = getKeywordAlerts();
  if (current.includes(trimmed)) return false;

  const updated = [...current, trimmed];
  localStorage.setItem(KEYWORDS_STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new Event('dsu_keywords_updated'));
  return true;
}

// 3. 키워드 삭제
export function removeKeywordAlert(keyword: string): boolean {
  if (typeof window === 'undefined') return false;
  const current = getKeywordAlerts();
  const updated = current.filter(k => k !== keyword);
  localStorage.setItem(KEYWORDS_STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new Event('dsu_keywords_updated'));
  return true;
}

// 4. 공지와 키워드 매칭 검사 (LLM 추출 키워드 + 제목 + 본문)
export function checkNoticeKeywordMatch(
  notice: Notice,
  userKeywords?: string[]
): { isMatched: boolean; matchedKeywords: string[] } {
  const keywords = userKeywords || getKeywordAlerts();
  if (!keywords.length) return { isMatched: false, matchedKeywords: [] };

  const matchedKeywords: string[] = [];
  const titleLower = notice.title.toLowerCase();
  const contentLower = (notice.contentText || '').toLowerCase();
  const aiKeywords = (notice.aiKeywords || []).map(k => k.toLowerCase());

  for (const kw of keywords) {
    const kwLower = kw.toLowerCase();
    // 1순위: LLM이 뽑아준 aiKeywords와 일치하는가?
    const inAiKeywords = aiKeywords.some(ak => ak.includes(kwLower) || kwLower.includes(ak));
    // 2순위: 제목에 포함되어 있는가?
    const inTitle = titleLower.includes(kwLower);
    // 3순위: 본문에 포함되어 있는가?
    const inContent = contentLower.includes(kwLower);

    if (inAiKeywords || inTitle || inContent) {
      matchedKeywords.push(kw);
    }
  }

  return {
    isMatched: matchedKeywords.length > 0,
    matchedKeywords,
  };
}
