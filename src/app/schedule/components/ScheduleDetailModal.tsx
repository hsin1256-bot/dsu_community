'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { X, Calendar, Clock, Edit2, Trash2, BellRing, ExternalLink } from 'lucide-react';
import { isDdayPinned, toggleDdayPin } from '@/lib/alert-settings';
import { todayKST, daysBetween } from '@/lib/date-kst';
import { CustomSchedule } from '../types';
import { getScheduleColor, getScheduleKind, getScheduleKindLabel } from '../utils';
import ScheduleTypeIcon from './ScheduleTypeIcon';

interface ScheduleDetailModalProps {
  schedule: CustomSchedule | null;
  onClose: () => void;
  onOpenEdit: (schedule: CustomSchedule) => void;
  onDelete: (id: string) => void;
}

export default function ScheduleDetailModal({
  schedule,
  onClose,
  onOpenEdit,
  onDelete,
}: ScheduleDetailModalProps) {
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    if (schedule) setPinned(isDdayPinned(schedule.id));
  }, [schedule]);

  if (!schedule) return null;

  const isPersonal = schedule.id.startsWith('personal-');
  const isBookmarkNotice = schedule.id.startsWith('personal-bookmark-');
  const noticeId = isBookmarkNotice ? schedule.id.replace('personal-bookmark-', '') : null;

  // 남은 날짜: 시작 전이면 D-n, 기간 중이면 0(D-Day), 종료 후면 음수
  const today = todayKST();
  const daysToStart = daysBetween(today, schedule.startDate);
  const dDay = daysToStart >= 0 ? daysToStart : schedule.endDate >= today ? 0 : -1;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-[360px] rounded-3xl shadow-2xl overflow-hidden p-5 space-y-4">
        {/* 상단 컬러 포인트 및 닫기 버튼 */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <ScheduleTypeIcon kind={getScheduleKind(schedule)} size="md" />
            <span className="text-xs font-bold text-slate-700">
              {isBookmarkNotice
                ? '북마크 일정'
                : isPersonal
                ? '개인일정'
                : `학사일정 · ${schedule.category || '공식'}`}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 일정 제목 */}
        <div>
          <h3 className="text-base font-extrabold text-slate-900 leading-snug flex items-start gap-2">
            <ScheduleTypeIcon kind={getScheduleKind(schedule)} size="sm" className="mt-0.5" />
            <span>{schedule.title}</span>
          </h3>
        </div>

        {/* 일정 일시 및 D-Day */}
        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              일정 기간
            </span>
            <div className="text-right">
              <div className="font-bold text-slate-800">
                {schedule.startDate}
                {schedule.startDate !== schedule.endDate &&
                  ` ~ ${schedule.endDate}`}
              </div>
              <div className="text-[11px] text-dongseo-700 font-semibold">
                {schedule.isAllDay || (!schedule.startTime && !schedule.endTime)
                  ? '하루 종일'
                  : `${schedule.startTime || '00:00'} ~ ${schedule.endTime || '00:00'}`}
              </div>
            </div>
          </div>

          {(
            <div className="flex items-center justify-between pt-1 border-t border-slate-200/50">
              <span className="text-slate-500 font-medium flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                남은 기간
              </span>
              <span className="font-extrabold text-dongseo-700 bg-dongseo-50 px-2 py-0.5 rounded-full text-[11px]">
                {dDay === 0
                  ? daysToStart === 0 ? 'D-Day (오늘)' : '진행 중'
                  : dDay > 0
                  ? `D-${dDay}`
                  : '종료된 일정'}
              </span>
            </div>
          )}
        </div>

        {/* D-Day 알림 받기 (끝나지 않은 일정만) */}
        {dDay >= 0 && (
          <button
            type="button"
            aria-pressed={pinned}
            onClick={() => setPinned(toggleDdayPin(schedule.id))}
            className={`w-full flex items-center gap-2 p-3 rounded-2xl border text-xs font-bold transition ${
              pinned ? 'bg-dongseo-50 border-dongseo-200 text-dongseo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <BellRing className={`w-4 h-4 ${pinned ? 'fill-dongseo-200' : ''}`} />
            <span className="flex-1 text-left">{pinned ? 'D-Day 알림 받는 중' : 'D-Day 알림 받기'}</span>
            <span className="text-[11px] font-medium text-slate-400">30일 전부터 알림함에 표시</span>
          </button>
        )}

        {/* 메모가 있는 경우 표시 */}
        {schedule.memo && (
          <div className="p-3 bg-amber-50/50 rounded-2xl border border-amber-100 text-xs">
            <span className="text-[11px] font-bold text-amber-800 block mb-1">메모</span>
            <p className="text-slate-700 whitespace-pre-wrap">{schedule.memo}</p>
          </div>
        )}

        {/* 북마크 공지인 경우 공지사항 바로가기 링크 제공 */}
        {noticeId && (
          <Link
            href={`/notices/${noticeId}`}
            className="w-full py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 text-amber-900 font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5 active:scale-98 shadow-2xs"
          >
            <ExternalLink className="w-3.5 h-3.5 text-amber-700" />
            공지사항 본문 바로가기
          </Link>
        )}

        {/* 버튼 그룹: 개인 일정에만 수정/삭제 버튼 제공, 학교 공식 일정은 확인(닫기) 버튼만 제공 */}
        <div className="flex items-center gap-2 pt-1">
          {isPersonal ? (
            <>
              <button
                type="button"
                onClick={() => onOpenEdit(schedule)}
                className="flex-1 py-2.5 bg-dongseo-50 hover:bg-dongseo-100 text-dongseo-700 font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Edit2 className="w-3.5 h-3.5" />
                수정
              </button>

              <button
                type="button"
                onClick={() => onDelete(schedule.id)}
                className="flex-1 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                삭제
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition active:scale-95"
              >
                닫기
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 bg-dongseo-700 hover:bg-dongseo-800 text-white font-extrabold text-xs rounded-xl transition shadow-xs active:scale-98"
            >
              확인
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
