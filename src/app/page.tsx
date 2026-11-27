import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import NoticeCard from '@/components/NoticeCard';
import { getNoticesFromDB } from '@/lib/db/notices';
import { getUpcomingSchedules } from '@/lib/db/schedules';
import { getCafeteriaMenus } from '@/lib/db/cafeteria';
import { todayKST, currentSemesterKST, daysBetween } from '@/lib/date-kst';
import {
  Calendar,
  Utensils,
  Megaphone,
  ArrowRight,
  Clock,
  Sparkles,
  ExternalLink,
  BookOpen,
  Bus,
  Layers,
  GraduationCap,
} from 'lucide-react';

// 공지·학사일정은 하루 몇 번만 바뀌므로 5분 단위로 다시 생성
export const revalidate = 300;

async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch (e) {
    console.error('[home]', e);
    return fallback;
  }
}

export default async function HomePage() {
  const today = todayKST();
  const { academicYear, semester } = currentSemesterKST();

  const [noticeResult, upcomingSchedules, gvMenus] = await Promise.all([
    safe(getNoticesFromDB({ page: 1, pageSize: 4 }), { data: [], total: 0 }),
    safe(getUpcomingSchedules(today, 2), []),
    safe(getCafeteriaMenus('글빌 식당'), []),
  ]);
  const recentNotices = noticeResult.data;
  const todaysLunch = gvMenus[0];

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col">
      <Header />

      <div className="p-4 space-y-5">
        {/* 상단 웰컴 배너 & D-Day 위젯 */}
        <section className="bg-gradient-to-br from-dongseo-800 to-dongseo-950 text-white rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center justify-between text-xs text-dongseo-200 mb-2">
              <span className="flex items-center gap-1 font-medium">
                <Clock className="w-3.5 h-3.5" />
                {academicYear}학년도 {semester}
              </span>
              <span className="bg-white/15 px-2 py-0.5 rounded-full text-[11px] font-semibold">
                동서대학교
              </span>
            </div>

            <h2 className="text-xl font-extrabold leading-snug">
              오늘도 활기찬 하루 되세요! 🎓
            </h2>

            {/* 다가오는 주요 학사일정 */}
            {upcomingSchedules.length > 0 && (
            <div className="mt-4 pt-3 border-t border-white/15 grid grid-cols-2 gap-2.5">
              {upcomingSchedules.map((item) => (
                <Link
                  key={item.id}
                  href="/schedule"
                  className="bg-white/10 hover:bg-white/20 transition p-2.5 rounded-xl block backdrop-blur-sm border border-white/10"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-dongseo-200 truncate">{item.category}</span>
                    <span className="text-xs font-black px-1.5 py-0.5 rounded bg-amber-400 text-slate-900">
                      {formatDDay(daysBetween(today, item.startDate))}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-white mt-1 truncate flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-full bg-[#9A25E2] flex items-center justify-center shrink-0 shadow-2xs">
                      <GraduationCap className="w-2 h-2 fill-white stroke-white stroke-[2]" />
                    </span>
                    <span className="truncate">{item.title}</span>
                  </p>
                </Link>
              ))}
            </div>
            )}
          </div>
        </section>

        {/* 바로가기 서비스 그리드 */}
        <section>
          <div className="grid grid-cols-4 gap-2 text-center">
            <a
              href="https://uni.dongseo.ac.kr"
              target="_blank"
              rel="noreferrer"
              className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm hover:border-dongseo-200 transition flex flex-col items-center gap-1.5"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-700">종합포털</span>
            </a>

            <a
              href="https://eclass.dongseo.ac.kr"
              target="_blank"
              rel="noreferrer"
              className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm hover:border-dongseo-200 transition flex flex-col items-center gap-1.5"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-700">E-캠퍼스</span>
            </a>

            <Link
              href="/cafeteria"
              className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm hover:border-dongseo-200 transition flex flex-col items-center gap-1.5"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Utensils className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-700">학식메뉴</span>
            </Link>

            <a
              href="https://www.dongseo.ac.kr/kr/index.php?pCode=MN2000045"
              target="_blank"
              rel="noreferrer"
              className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm hover:border-dongseo-200 transition flex flex-col items-center gap-1.5"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Bus className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-700">셔틀버스</span>
            </a>
          </div>
        </section>

        {/* 오늘의 학식 하이라이트 */}
        {todaysLunch && (
          <section className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-dongseo-50 text-dongseo-700">
                  <Utensils className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">오늘의 글빌 식당 식단표</h3>
                  <p className="text-[11px] text-slate-400">{todaysLunch.cornerName}</p>
                </div>
              </div>
              <Link
                href="/cafeteria"
                className="text-xs font-bold text-dongseo-700 hover:text-dongseo-800 flex items-center gap-0.5"
              >
                전체보기 <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p className="text-sm font-semibold text-slate-800">
                {(todaysLunch.menuItems && todaysLunch.menuItems.length > 0
                  ? todaysLunch.menuItems
                  : [todaysLunch.name]
                ).join(' · ')}
              </p>
              <div className="flex items-center justify-between text-xs text-slate-500 mt-2 pt-2 border-t border-slate-200/60">
                <span className="font-bold text-dongseo-700">{todaysLunch.price}</span>
                <span>⭐️ {todaysLunch.rating.toFixed(1)} ({todaysLunch.reviewCount}개 평가)</span>
              </div>
            </div>
          </section>
        )}

        {/* 최신 공지사항 섹션 */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-dongseo-50 text-dongseo-700">
                <Megaphone className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">캠퍼스 최신 공지</h3>
            </div>
            <Link
              href="/notices"
              className="text-xs font-bold text-dongseo-700 hover:text-dongseo-800 flex items-center gap-0.5"
            >
              더보기 <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {recentNotices.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6 bg-white rounded-2xl border border-slate-100">
                아직 불러온 공지가 없습니다.
              </p>
            ) : (
              recentNotices.map((notice) => <NoticeCard key={notice.id} notice={notice} />)
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

/** 시작일까지 남은 일수 → 'D-3' / 'D-Day' / '진행 중' */
function formatDDay(diff: number): string {
  if (diff > 0) return `D-${diff}`;
  if (diff === 0) return 'D-Day';
  return '진행 중';
}
