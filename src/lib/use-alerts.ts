'use client';

import { useCallback, useEffect, useState } from 'react';
import { AcademicSchedule, Notice } from '@/types';
import { getAlertSettings, ALERT_SETTINGS_EVENT, AlertSettings } from '@/lib/alert-settings';
import { getKeywordAlerts, checkNoticeKeywordMatch } from '@/lib/keyword-alerts';
import { todayKST, daysBetween } from '@/lib/date-kst';

export type AlertItem =
  | {
      id: string;
      type: 'dday';
      title: string;
      daysLeft: number;
      date: string;
      scheduleId: string;
      isPersonal: boolean;
    }
  | {
      id: string;
      type: 'keyword';
      title: string;
      date: string;
      noticeId: string;
      keywords: string[];
    };

const SEEN_KEY = 'dsu_alerts_seen';
const CACHE_KEY = 'dsu_alert_source_cache';
const CACHE_TTL_MS = 10 * 60 * 1000;
const KEYWORD_LOOKBACK_DAYS = 14;
const PINNED_LOOKAHEAD_DAYS = 30;

type PersonalSchedule = { id: string; title: string; startDate: string; endDate: string };
type Sources = { notices: Notice[]; schedules: AcademicSchedule[]; fetchedAt: number };

async function loadSources(): Promise<Sources> {
  try {
    const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null') as Sources | null;
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached;
  } catch {
    /* 캐시 없음 */
  }

  const year = Number(todayKST().slice(0, 4));
  const [n, s] = await Promise.all([
    fetch('/api/notices?page=1&pageSize=50').then((r) => r.json()).catch(() => null),
    fetch(`/api/schedule?from=${year}&to=${year + 1}`).then((r) => r.json()).catch(() => null),
  ]);
  const sources: Sources = {
    notices: n?.success ? n.data : [],
    schedules: s?.success ? s.data : [],
    fetchedAt: Date.now(),
  };
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(sources));
  } catch {
    /* 저장 공간 부족 등은 무시 */
  }
  return sources;
}

function loadPersonal(): PersonalSchedule[] {
  try {
    const list = JSON.parse(localStorage.getItem('dsu_personal_schedules') || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** 설정에 맞는 알림 목록 계산 (순수 함수: 테스트·재사용용) */
export function buildAlerts(
  settings: AlertSettings,
  sources: { notices: Notice[]; schedules: AcademicSchedule[]; personal: PersonalSchedule[]; keywords: string[] },
  today: string
): AlertItem[] {
  const items: AlertItem[] = [];
  const { dday } = settings;

  if (dday.enabled) {
    const consider = (s: { id: string; title: string; startDate: string }, isPersonal: boolean, matchesFilter: boolean) => {
      const daysLeft = daysBetween(today, s.startDate);
      if (daysLeft < 0) return;
      const pinned = dday.pinnedIds.includes(s.id);
      const hit = pinned ? daysLeft <= PINNED_LOOKAHEAD_DAYS : matchesFilter && dday.daysBefore.includes(daysLeft);
      if (!hit) return;
      items.push({
        id: `dday:${s.id}:${daysLeft}`,
        type: 'dday',
        title: s.title,
        daysLeft,
        date: s.startDate,
        scheduleId: s.id,
        isPersonal,
      });
    };

    for (const s of sources.schedules) {
      const matches = dday.categories.includes(s.category) && (!dday.importantOnly || Boolean(s.isImportant));
      consider(s, false, matches);
    }
    for (const p of sources.personal) {
      consider(p, true, dday.includePersonal);
    }
  }

  if (settings.keyword.enabled && sources.keywords.length > 0) {
    for (const notice of sources.notices) {
      if (daysBetween(notice.date, today) > KEYWORD_LOOKBACK_DAYS) continue;
      const { isMatched, matchedKeywords } = checkNoticeKeywordMatch(notice, sources.keywords);
      if (!isMatched) continue;
      items.push({
        id: `kw:${notice.id}`,
        type: 'keyword',
        title: notice.title,
        date: notice.date,
        noticeId: notice.id,
        keywords: matchedKeywords,
      });
    }
  }

  // D-Day 는 임박한 순, 키워드 공지는 최신순
  return items.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dday' ? -1 : 1;
    if (a.type === 'dday' && b.type === 'dday') return a.daysLeft - b.daysLeft;
    return b.date.localeCompare(a.date);
  });
}

function getSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

/** 알림 목록 + 안 읽은 개수 (헤더 종 아이콘, 알림함 화면에서 사용) */
export function useAlerts() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [unseenCount, setUnseenCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const sources = await loadSources();
    const list = buildAlerts(
      getAlertSettings(),
      { ...sources, personal: loadPersonal(), keywords: getKeywordAlerts() },
      todayKST()
    );
    const seen = getSeen();
    setAlerts(list);
    setUnseenCount(list.filter((a) => !seen.has(a.id)).length);
    setLoading(false);
  }, []);

  const markAllSeen = useCallback(() => {
    try {
      // 현재 알림 id 만 보관 (지난 알림 id 가 계속 쌓이지 않도록)
      localStorage.setItem(SEEN_KEY, JSON.stringify(alerts.map((a) => a.id)));
    } catch {
      /* 무시 */
    }
    setUnseenCount(0);
    window.dispatchEvent(new Event('dsu_alerts_seen'));
  }, [alerts]);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    // 다른 화면(알림함)에서 읽음 처리하면 헤더 배지만 0으로 (다시 불러오지 않음 → 무한 반복 방지)
    const onSeen = () => setUnseenCount(0);
    const events = [ALERT_SETTINGS_EVENT, 'dsu_keywords_updated'];
    events.forEach((e) => window.addEventListener(e, onChange));
    window.addEventListener('dsu_alerts_seen', onSeen);
    return () => {
      events.forEach((e) => window.removeEventListener(e, onChange));
      window.removeEventListener('dsu_alerts_seen', onSeen);
    };
  }, [refresh]);

  return { alerts, unseenCount, loading, refresh, markAllSeen };
}
