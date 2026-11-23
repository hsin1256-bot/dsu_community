import React from 'react';
import Header from '@/components/Header';
import { APP_NAME, APP_VERSION, DATA_SOURCES } from '@/lib/app-info';
import { getNoticesLastUpdatedAt } from '@/lib/db/notices';
import { getSchedulesByYearRange } from '@/lib/db/schedules';
import { currentYearKST } from '@/lib/date-kst';
import { ExternalLink } from 'lucide-react';

export const dynamic = 'force-dynamic';

function formatKst(iso: string | null) {
  if (!iso) return '아직 없음';
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' });
}

const LICENSES = ['Next.js (MIT)', 'React (MIT)', 'Supabase JS (MIT)', 'Tailwind CSS (MIT)', 'Lucide Icons (ISC)', 'Leaflet (BSD-2-Clause)', 'cheerio (MIT)', 'sanitize-html (MIT)'];

export default async function AboutPage() {
  const year = currentYearKST();
  const [noticesAt, schedules] = await Promise.all([
    getNoticesLastUpdatedAt().catch(() => null),
    getSchedulesByYearRange(year, year).catch(() => ({ syncedAt: null })),
  ]);

  const rows = [
    { label: '앱 버전', value: APP_VERSION },
    { label: '공지사항 업데이트', value: formatKst(noticesAt) },
    { label: '학사일정 업데이트', value: formatKst(schedules.syncedAt) },
  ];

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col pb-6">
      <Header showBack title="앱 정보" />

      <div className="p-4 space-y-4">
        <section className="bg-white rounded-2xl border border-slate-100 p-5 text-center">
          <p className="text-lg font-extrabold text-slate-900">{APP_NAME}</p>
          <p className="text-xs text-slate-400 mt-1">동서대학교 학생이 만든 캠퍼스 정보 앱</p>
        </section>

        <section className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-slate-500">{r.label}</span>
              <span className="font-semibold text-slate-800">{r.value}</span>
            </div>
          ))}
        </section>

        <section className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2">
          <h2 className="text-xs font-bold text-slate-700">데이터 출처</h2>
          {DATA_SOURCES.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between text-xs text-slate-600 hover:text-dongseo-700">
              <span>{s.label}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          ))}
          <p className="text-[11px] text-slate-400 leading-relaxed pt-2 border-t border-slate-100">
            이 앱은 동서대학교 공식 앱이 아니에요. 공지·일정은 학교 홈페이지에서 주기적으로 가져오며, AI 요약은 틀릴 수 있어요.
            중요한 내용은 반드시 학교 홈페이지 원문을 확인해 주세요.
          </p>
        </section>

        <section className="bg-white rounded-2xl border border-slate-100 p-4">
          <h2 className="text-xs font-bold text-slate-700 mb-2">오픈소스 라이선스</h2>
          <ul className="text-[11px] text-slate-500 space-y-1">
            {LICENSES.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
