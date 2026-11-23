'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { useAlerts } from '@/lib/use-alerts';
import { BellOff, CalendarClock, Megaphone, Settings, Loader2 } from 'lucide-react';

function ddayLabel(daysLeft: number) {
  return daysLeft === 0 ? 'D-Day' : `D-${daysLeft}`;
}

export default function AlertsPage() {
  const { alerts, loading, markAllSeen } = useAlerts();

  // 알림함을 열면 현재 알림을 모두 읽음 처리 (처음 불러온 뒤 한 번만)
  const markedRef = useRef(false);
  useEffect(() => {
    if (loading || markedRef.current) return;
    markedRef.current = true;
    markAllSeen();
  }, [loading, markAllSeen]);

  const ddays = alerts.filter((a) => a.type === 'dday');
  const keywordNotices = alerts.filter((a) => a.type === 'keyword');

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col pb-6">
      <Header showBack title="알림함" />

      <div className="p-4 space-y-5">
        <div className="flex justify-end">
          <Link href="/my/notifications" className="inline-flex items-center gap-1 text-xs font-bold text-dongseo-700">
            <Settings className="w-3.5 h-3.5" /> 알림 설정
          </Link>
        </div>

        {loading ? (
          <div className="flex flex-col items-center py-20 text-slate-400">
            <Loader2 className="w-7 h-7 animate-spin text-dongseo-700 mb-2" />
            <span className="text-xs">알림을 확인하는 중...</span>
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 p-6">
            <BellOff className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">새 알림이 없어요</p>
            <p className="text-xs text-slate-400 mt-1">알림 설정에서 키워드와 D-Day 조건을 바꿔 보세요.</p>
          </div>
        ) : (
          <>
            {ddays.length > 0 && (
              <section>
                <h2 className="text-[11px] font-bold text-slate-400 px-1 mb-1.5">다가오는 일정</h2>
                <ul className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100">
                  {ddays.map((a) =>
                    a.type === 'dday' ? (
                      <li key={a.id}>
                        <Link href="/schedule" className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                          <CalendarClock className="w-4 h-4 text-dongseo-700 shrink-0" />
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-semibold text-slate-800 truncate">{a.title}</span>
                            <span className="block text-[11px] text-slate-400">
                              {a.date} · {a.isPersonal ? '개인 일정' : '학사일정'}
                            </span>
                          </span>
                          <span
                            className={`text-xs font-black px-2 py-0.5 rounded-md shrink-0 ${
                              a.daysLeft <= 1 ? 'bg-rose-500 text-white' : 'bg-amber-400 text-slate-900'
                            }`}
                          >
                            {ddayLabel(a.daysLeft)}
                          </span>
                        </Link>
                      </li>
                    ) : null
                  )}
                </ul>
              </section>
            )}

            {keywordNotices.length > 0 && (
              <section>
                <h2 className="text-[11px] font-bold text-slate-400 px-1 mb-1.5">키워드 공지</h2>
                <ul className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100">
                  {keywordNotices.map((a) =>
                    a.type === 'keyword' ? (
                      <li key={a.id}>
                        <Link href={`/notices/${a.noticeId}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                          <Megaphone className="w-4 h-4 text-amber-600 shrink-0" />
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-semibold text-slate-800 truncate">{a.title}</span>
                            <span className="block text-[11px] text-slate-400">
                              {a.date} · {a.keywords.map((k) => `#${k}`).join(' ')}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ) : null
                  )}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
