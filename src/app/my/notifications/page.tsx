'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { Bell, CalendarClock, Plus, X, Pin, Info } from 'lucide-react';
import { getKeywordAlerts, addKeywordAlert, removeKeywordAlert } from '@/lib/keyword-alerts';
import {
  AlertSettings,
  ACADEMIC_CATEGORIES,
  DDAY_OPTIONS,
  DEFAULT_ALERT_SETTINGS,
  getAlertSettings,
  saveAlertSettings,
  toggleDdayPin,
  ALERT_SETTINGS_EVENT,
} from '@/lib/alert-settings';

const MAX_KEYWORDS = 20;
const MAX_KEYWORD_LENGTH = 20;

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${checked ? 'bg-dongseo-700' : 'bg-slate-300'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
        selected ? 'bg-dongseo-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {children}
    </button>
  );
}

type PinnedInfo = { id: string; title: string; startDate: string };

export default function NotificationSettingsPage() {
  const [settings, setSettings] = useState<AlertSettings>(DEFAULT_ALERT_SETTINGS);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [pinnedInfo, setPinnedInfo] = useState<PinnedInfo[]>([]);

  useEffect(() => {
    const load = () => {
      setSettings(getAlertSettings());
      setKeywords(getKeywordAlerts());
    };
    load();
    window.addEventListener(ALERT_SETTINGS_EVENT, load);
    window.addEventListener('dsu_keywords_updated', load);
    return () => {
      window.removeEventListener(ALERT_SETTINGS_EVENT, load);
      window.removeEventListener('dsu_keywords_updated', load);
    };
  }, []);

  // 직접 고른 D-Day 일정의 제목 표시용 (학사일정 + 개인일정)
  useEffect(() => {
    const ids = settings.dday.pinnedIds;
    if (ids.length === 0) {
      setPinnedInfo([]);
      return;
    }
    const year = new Date().getFullYear();
    let personal: PinnedInfo[] = [];
    try {
      personal = JSON.parse(localStorage.getItem('dsu_personal_schedules') || '[]');
    } catch {
      personal = [];
    }
    fetch(`/api/schedule?from=${year - 1}&to=${year + 2}`)
      .then((r) => r.json())
      .then((json) => {
        const all: PinnedInfo[] = [...(json.success ? json.data : []), ...personal];
        setPinnedInfo(ids.map((id) => all.find((s) => s.id === id)).filter((s): s is PinnedInfo => Boolean(s)));
      })
      .catch(() => setPinnedInfo(personal.filter((p) => ids.includes(p.id))));
  }, [settings.dday.pinnedIds]);

  const update = (next: AlertSettings) => {
    setSettings(next);
    saveAlertSettings(next);
  };
  const setDday = (patch: Partial<AlertSettings['dday']>) => update({ ...settings, dday: { ...settings.dday, ...patch } });
  const toggleIn = (list: (string | number)[], v: string | number) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const handleAddKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    const kw = input.trim();
    setError('');
    if (!kw) return;
    if (kw.length > MAX_KEYWORD_LENGTH) return setError(`키워드는 ${MAX_KEYWORD_LENGTH}자 이하로 입력해 주세요.`);
    if (keywords.length >= MAX_KEYWORDS) return setError(`키워드는 최대 ${MAX_KEYWORDS}개까지 등록할 수 있어요.`);
    if (!addKeywordAlert(kw)) return setError('이미 등록된 키워드예요.');
    setInput('');
  };

  const { dday } = settings;

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col pb-6">
      <Header showBack title="알림 설정" />

      <div className="p-4 space-y-4">
        <p className="flex gap-2 text-[11px] text-slate-500 bg-white border border-slate-100 rounded-2xl p-3 leading-relaxed">
          <Info className="w-4 h-4 text-slate-400 shrink-0" />
          <span>
            설정에 맞는 공지와 일정이 상단 <Bell className="inline w-3 h-3" /> <strong>알림함</strong>에 모여요. 앱을 닫았을 때 오는 푸시
            알림은 아직 지원하지 않아요. 설정은 이 기기에 저장돼요.
          </span>
        </p>

        {/* 1. 공지 키워드 알림 */}
        <section className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </span>
            <div className="flex-1">
              <h2 className="text-sm font-bold text-slate-900">공지 키워드 알림</h2>
              <p className="text-[11px] text-slate-400">최근 2주 공지 중 키워드가 들어간 글을 알려줘요</p>
            </div>
            <Toggle label="공지 키워드 알림" checked={settings.keyword.enabled} onChange={(v) => update({ ...settings, keyword: { enabled: v } })} />
          </div>

          <div className={settings.keyword.enabled ? '' : 'opacity-40 pointer-events-none'}>
            <form onSubmit={handleAddKeyword} className="flex gap-2">
              <input
                type="text"
                value={input}
                maxLength={MAX_KEYWORD_LENGTH}
                onChange={(e) => setInput(e.target.value)}
                placeholder="예: 장학금, 수강신청, 기숙사"
                className="flex-1 bg-slate-100 text-slate-900 text-xs px-3 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-dongseo-700"
              />
              <button type="submit" className="px-3.5 bg-dongseo-700 hover:bg-dongseo-800 text-white rounded-xl text-xs font-bold flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> 추가
              </button>
            </form>
            {error && <p className="text-[11px] text-rose-600 mt-1.5">{error}</p>}

            <div className="flex flex-wrap gap-1.5 mt-3">
              {keywords.length === 0 ? (
                <p className="text-xs text-slate-400">등록된 키워드가 없어요.</p>
              ) : (
                keywords.map((kw) => (
                  <span key={kw} className="inline-flex items-center gap-1 text-xs font-semibold pl-2.5 pr-1 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-lg">
                    #{kw}
                    <button type="button" onClick={() => removeKeywordAlert(kw)} aria-label={`${kw} 삭제`} className="p-0.5 text-amber-500 hover:text-amber-800 rounded-full">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>
        </section>

        {/* 2. 캘린더 D-Day 알림 */}
        <section className="bg-white rounded-2xl border border-slate-100 p-4 space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-dongseo-50 text-dongseo-700 flex items-center justify-center">
              <CalendarClock className="w-4 h-4" />
            </span>
            <div className="flex-1">
              <h2 className="text-sm font-bold text-slate-900">캘린더 D-Day 알림</h2>
              <p className="text-[11px] text-slate-400">학사일정·개인일정 시작 전에 알려줘요</p>
            </div>
            <Toggle label="캘린더 D-Day 알림" checked={dday.enabled} onChange={(v) => setDday({ enabled: v })} />
          </div>

          <div className={`space-y-4 ${dday.enabled ? '' : 'opacity-40 pointer-events-none'}`}>
            <div>
              <h3 className="text-xs font-bold text-slate-700 mb-2">언제 알려드릴까요?</h3>
              <div className="flex flex-wrap gap-1.5">
                {DDAY_OPTIONS.map((d) => (
                  <Chip key={d} selected={dday.daysBefore.includes(d)} onClick={() => setDday({ daysBefore: (toggleIn(dday.daysBefore, d) as number[]).sort((a, b) => b - a) })}>
                    {d === 0 ? '당일' : `${d}일 전`}
                  </Chip>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-700 mb-2">어떤 학사일정을 알려드릴까요?</h3>
              <div className="flex flex-wrap gap-1.5">
                {ACADEMIC_CATEGORIES.map((c) => (
                  <Chip key={c} selected={dday.categories.includes(c)} onClick={() => setDday({ categories: toggleIn(dday.categories, c) as string[] })}>
                    {c}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-center justify-between gap-3">
                <span>
                  <span className="block text-xs font-bold text-slate-700">중요 일정만</span>
                  <span className="block text-[11px] text-slate-400">개강·종강·시험·등록금·수강신청</span>
                </span>
                <Toggle label="중요 일정만" checked={dday.importantOnly} onChange={(v) => setDday({ importantOnly: v })} />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span>
                  <span className="block text-xs font-bold text-slate-700">개인 일정 포함</span>
                  <span className="block text-[11px] text-slate-400">캘린더에서 직접 추가한 일정</span>
                </span>
                <Toggle label="개인 일정 포함" checked={dday.includePersonal} onChange={(v) => setDday({ includePersonal: v })} />
              </label>
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-700 mb-1">직접 고른 일정</h3>
              <p className="text-[11px] text-slate-400 mb-2">
                위 조건과 상관없이 30일 전부터 매일 알려줘요. <Link href="/schedule" className="text-dongseo-700 font-semibold underline">캘린더</Link>에서 일정을 눌러 추가할 수 있어요.
              </p>
              {pinnedInfo.length === 0 ? (
                <p className="text-xs text-slate-400">아직 고른 일정이 없어요.</p>
              ) : (
                <ul className="space-y-1.5">
                  {pinnedInfo.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 text-xs bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                      <Pin className="w-3.5 h-3.5 text-dongseo-700 shrink-0" />
                      <span className="flex-1 truncate font-semibold text-slate-700">{s.title}</span>
                      <span className="text-slate-400 shrink-0">{s.startDate}</span>
                      <button type="button" onClick={() => toggleDdayPin(s.id)} aria-label={`${s.title} 알림 해제`} className="p-0.5 text-slate-400 hover:text-slate-700">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
