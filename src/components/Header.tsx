'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bell, GraduationCap } from 'lucide-react';
import { useAlerts } from '@/lib/use-alerts';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
}

export default function Header({ title, showBack = false }: HeaderProps) {
  const router = useRouter();

  const { unseenCount } = useAlerts();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {showBack ? (
            <button
              onClick={() => router.back()}
              className="p-1 -ml-1 text-slate-700 hover:text-slate-900 rounded-lg active:bg-slate-100"
              aria-label="뒤로가기"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-dongseo-700 flex items-center justify-center text-white shadow-sm shadow-dongseo-700/20">
              <GraduationCap className="w-5 h-5" />
            </div>
          )}

          <div>
            {title ? (
              <h1 className="text-base font-bold text-slate-900 tracking-tight">{title}</h1>
            ) : (
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-dongseo-700 tracking-wider uppercase">
                  Dongseo University
                </span>
                <span className="text-base font-extrabold text-slate-900 -mt-0.5 tracking-tight">
                  동서대 캠퍼스
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Link
            href="/alerts"
            className="p-2 text-slate-600 hover:text-dongseo-700 rounded-lg hover:bg-slate-50 transition relative"
            aria-label={unseenCount > 0 ? `알림함 (새 알림 ${unseenCount}개)` : '알림함'}
          >
            <Bell className="w-5 h-5" />
            {unseenCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-dongseo-600 text-white text-[10px] font-bold rounded-full ring-2 ring-white flex items-center justify-center">
                {unseenCount > 9 ? '9+' : unseenCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
