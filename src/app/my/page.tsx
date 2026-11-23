'use client';

import React, { useEffect, useState } from 'react';
import Header from '@/components/Header';
import MenuList from '@/components/my/MenuList';
import { getBookmarkedIds } from '@/lib/bookmarks';
import { getKeywordAlerts } from '@/lib/keyword-alerts';
import { getAlertSettings } from '@/lib/alert-settings';
import { Bookmark, BellRing, MessageSquareText, Info, FileText, ShieldCheck, UserRound, Mail } from 'lucide-react';

export default function MyPage() {
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [alertSummary, setAlertSummary] = useState('');

  useEffect(() => {
    const load = () => {
      setBookmarkCount(getBookmarkedIds().length);
      const s = getAlertSettings();
      const parts = [
        s.keyword.enabled ? `키워드 ${getKeywordAlerts().length}개` : '키워드 끔',
        s.dday.enabled ? `D-Day ${s.dday.daysBefore.length ? s.dday.daysBefore.map((d) => (d === 0 ? '당일' : `${d}일 전`)).join('·') : '없음'}` : 'D-Day 끔',
      ];
      setAlertSummary(parts.join(' / '));
    };
    load();
    window.addEventListener('dsu_bookmarks_updated', load);
    return () => window.removeEventListener('dsu_bookmarks_updated', load);
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col pb-24">
      <Header title="마이" />

      <div className="p-4 space-y-5">
        {/* 프로필 카드: 로그인 기능 연결 전에는 게스트 안내 */}
        <section className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
            <UserRound className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900">게스트</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              보관함·알림 설정은 이 기기에 저장돼요.
              <br />
              학교 메일 로그인은 준비 중이에요.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full shrink-0">
            <Mail className="w-3 h-3" />
            준비 중
          </span>
        </section>

        <MenuList
          title="내 활동"
          items={[
            { href: '/bookmarks', label: '보관함', icon: Bookmark, description: '스크랩한 공지', badge: bookmarkCount },
            { href: '/my/notifications', label: '알림 설정', icon: BellRing, description: alertSummary || '공지 키워드 · 캘린더 D-Day' },
          ]}
        />

        <MenuList
          title="고객지원"
          items={[
            { href: '/my/feedback', label: '문의 및 피드백', icon: MessageSquareText, description: '버그 제보, 기능 제안, 정보 오류 신고' },
            { href: '/my/about', label: '앱 정보', icon: Info, description: '버전, 데이터 출처, 업데이트 시각' },
          ]}
        />

        <MenuList
          title="약관 및 정책"
          items={[
            { href: '/my/terms', label: '이용약관', icon: FileText },
            { href: '/my/privacy', label: '개인정보처리방침', icon: ShieldCheck },
          ]}
        />
      </div>
    </main>
  );
}
