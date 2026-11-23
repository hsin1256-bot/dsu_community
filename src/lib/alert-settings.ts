'use client';

/**
 * 알림 설정 (이 기기 localStorage 저장 — 로그인 기능이 생기면 계정으로 옮길 예정)
 *
 * - 키워드 알림: 등록한 키워드가 들어간 공지를 알림함에 표시 (키워드 목록은 keyword-alerts.ts)
 * - D-Day 알림: 학사일정/개인일정이 N일 남았을 때 알림함에 표시
 *
 * ⚠️ 현재는 "앱 안 알림함" 방식입니다. 앱을 닫아도 오는 푸시 알림은 서버 푸시 기능이 필요합니다.
 */

export const ACADEMIC_CATEGORIES = ['수강/성적', '등록/장학', '시험', '휴학/복학', '행사'] as const;
export const DDAY_OPTIONS = [30, 14, 7, 3, 1, 0] as const;

export interface AlertSettings {
  keyword: {
    enabled: boolean;
  };
  dday: {
    enabled: boolean;
    /** 시작일까지 남은 날짜가 이 중 하나일 때 알림 (0 = 당일) */
    daysBefore: number[];
    /** 알림 받을 학사일정 분류 */
    categories: string[];
    /** 학교가 '중요'로 분류한 일정(개강·시험·등록금 등)만 */
    importantOnly: boolean;
    /** 내가 추가한 개인 일정도 포함 */
    includePersonal: boolean;
    /** 캘린더에서 직접 "D-Day 알림 받기"를 켠 일정 id (분류·중요 설정과 상관없이 항상 알림) */
    pinnedIds: string[];
  };
}

const STORAGE_KEY = 'dsu_alert_settings';
export const ALERT_SETTINGS_EVENT = 'dsu_alert_settings_updated';

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  keyword: { enabled: true },
  dday: {
    enabled: true,
    daysBefore: [7, 3, 1, 0],
    categories: ['수강/성적', '등록/장학', '시험'],
    importantOnly: true,
    includePersonal: true,
    pinnedIds: [],
  },
};

export function getAlertSettings(): AlertSettings {
  if (typeof window === 'undefined') return DEFAULT_ALERT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ALERT_SETTINGS;
    const parsed = JSON.parse(raw);
    // 저장된 값에 빠진 항목은 기본값으로 채움 (설정 항목이 늘어나도 안전)
    return {
      keyword: { ...DEFAULT_ALERT_SETTINGS.keyword, ...parsed.keyword },
      dday: { ...DEFAULT_ALERT_SETTINGS.dday, ...parsed.dday },
    };
  } catch {
    return DEFAULT_ALERT_SETTINGS;
  }
}

export function saveAlertSettings(settings: AlertSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event(ALERT_SETTINGS_EVENT));
  } catch (e) {
    console.error('알림 설정 저장 실패', e);
  }
}

export function updateAlertSettings(updater: (prev: AlertSettings) => AlertSettings): AlertSettings {
  const next = updater(getAlertSettings());
  saveAlertSettings(next);
  return next;
}

export function isDdayPinned(scheduleId: string): boolean {
  return getAlertSettings().dday.pinnedIds.includes(scheduleId);
}

/** 캘린더 일정 상세에서 "D-Day 알림 받기" 토글 */
export function toggleDdayPin(scheduleId: string): boolean {
  let pinned = false;
  updateAlertSettings((prev) => {
    const has = prev.dday.pinnedIds.includes(scheduleId);
    pinned = !has;
    return {
      ...prev,
      dday: {
        ...prev.dday,
        pinnedIds: has ? prev.dday.pinnedIds.filter((id) => id !== scheduleId) : [...prev.dday.pinnedIds, scheduleId],
      },
    };
  });
  return pinned;
}
