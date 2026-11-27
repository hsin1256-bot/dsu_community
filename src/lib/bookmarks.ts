'use client';

import { Notice } from '@/types';

const STORAGE_KEY = 'dsu_bookmarked_notices';
const PERSONAL_SCHEDULES_KEY = 'dsu_personal_schedules';

export function getBookmarkedIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function isNoticeBookmarked(id: string): boolean {
  const ids = getBookmarkedIds();
  return ids.includes(id);
}

/** 날짜 문자열 정규화 (YYYY-MM-DD) */
function normalizeDateStr(d?: string): string {
  if (!d) return new Date().toISOString().slice(0, 10);
  const clean = d.trim().replace(/\./g, '-');
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  const parts = clean.split('-');
  if (parts.length === 3) {
    const y = parts[0].length === 2 ? `20${parts[0]}` : parts[0];
    const m = parts[1].padStart(2, '0');
    const day = parts[2].padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return new Date().toISOString().slice(0, 10);
}

/**
 * 공지사항 북마크 토글 및 캘린더 개인 일정 자동 연동
 * @param noticeOrId 공지 객체(권장) 또는 공지 ID
 * @returns 변경된 북마크 상태 (true: 북마크 추가됨, false: 해제됨)
 */
export function toggleNoticeBookmark(
  noticeOrId: string | (Partial<Notice> & { id: string })
): boolean {
  if (typeof window === 'undefined') return false;

  const id = typeof noticeOrId === 'string' ? noticeOrId : noticeOrId.id;
  const notice = typeof noticeOrId === 'object' ? noticeOrId : null;

  const ids = getBookmarkedIds();
  let updated: string[];
  let nowBookmarked = false;

  if (ids.includes(id)) {
    updated = ids.filter((item) => item !== id);
    nowBookmarked = false;
  } else {
    updated = [...ids, id];
    nowBookmarked = true;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    // 📅 캘린더 개인 일정(dsu_personal_schedules) 자동 동기화
    const scheduleId = `personal-bookmark-${id}`;
    const rawSchedules = localStorage.getItem(PERSONAL_SCHEDULES_KEY);
    let schedules: any[] = [];
    try {
      schedules = rawSchedules ? JSON.parse(rawSchedules) : [];
      if (!Array.isArray(schedules)) schedules = [];
    } catch {
      schedules = [];
    }

    if (nowBookmarked) {
      // 북마크 추가: 캘린더에 일정 자동 등록
      const eventDate = normalizeDateStr(notice?.aiDeadline || notice?.date);
      const newSchedule = {
        id: scheduleId,
        title: `[공지] ${notice?.title || '북마크한 공지사항'}`,
        startDate: eventDate,
        endDate: eventDate,
        category: notice?.category || '공지 북마크',
        color: '#FF9500', // 북마크 공지 전용 오렌지 포인트 컬러
        memo: `공지사항 제목: ${notice?.title || ''}\n카테고리: ${notice?.category || '공지'}\n등록일: ${notice?.date || eventDate}${notice?.aiDeadline ? `\n마감일: ${notice.aiDeadline}` : ''}\n바로가기: /notices/${id}`,
        isAllDay: true,
      };

      // 기존 중복 제거 후 앞단에 추가
      schedules = [newSchedule, ...schedules.filter((s: any) => s.id !== scheduleId)];
    } else {
      // 북마크 해제: 캘린더에서 해당 공지 일정 자동 제거
      schedules = schedules.filter((s: any) => s.id !== scheduleId);
    }

    localStorage.setItem(PERSONAL_SCHEDULES_KEY, JSON.stringify(schedules));

    // 실시간 이벤트 전파 (북마크 탭 & 캘린더 탭 즉시 리렌더링)
    window.dispatchEvent(new Event('dsu_bookmarks_updated'));
    window.dispatchEvent(new Event('dsu_personal_schedules_updated'));
  } catch (e) {
    console.error('Failed to update bookmark or sync calendar in localStorage', e);
  }

  return nowBookmarked;
}
