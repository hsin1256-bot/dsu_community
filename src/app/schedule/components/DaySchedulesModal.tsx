'use client';

import React from 'react';
import { X, Calendar, ChevronRight, Plus } from 'lucide-react';
import { CustomSchedule } from '../types';
import { getScheduleColor, getScheduleKind, getScheduleKindLabel, formatKoreanDateWithWeekday } from '../utils';
import ScheduleTypeIcon from './ScheduleTypeIcon';

interface DaySchedulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string;
  schedules: CustomSchedule[];
  onSelectSchedule: (schedule: CustomSchedule) => void;
  onOpenAddModal?: (dateStr: string) => void;
}

export default function DaySchedulesModal({
  isOpen,
  onClose,
  dateStr,
  schedules,
  onSelectSchedule,
  onOpenAddModal,
}: DaySchedulesModalProps) {
  if (!isOpen || !dateStr) return null;

  const formattedDate = formatKoreanDateWithWeekday(dateStr);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-[380px] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95">
        {/* 상단 헤더 */}
        <div className="flex items-center justify-between border-b border-slate-100 p-4 pb-3">
          <div>
            <div className="flex items-center gap-1.5 text-dongseo-700 font-extrabold text-xs">
              <Calendar className="w-3.5 h-3.5" />
              <span>전체 일정 ({schedules.length}개)</span>
            </div>
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight mt-0.5">
              {formattedDate}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 일정 리스트 (스크롤 가능) */}
        <div className="p-4 space-y-2.5 overflow-y-auto flex-1 divide-y divide-slate-100/80">
          {schedules.map((s, idx) => {
            const badgeColor = getScheduleColor(s);
            const fixedEndDate = s.endDate && s.endDate >= s.startDate ? s.endDate : s.startDate;
            const isMultiDay = s.startDate !== fixedEndDate;
            const isStartDay = dateStr === s.startDate;
            const isEndDay = dateStr === fixedEndDate;
            const titleSuffix = isMultiDay
              ? isStartDay
                ? ' (시작)'
                : isEndDay
                ? ' (종료)'
                : ''
              : '';
            const displayTitle = s.title.includes('시작') || s.title.includes('종료')
              ? s.title
              : `${s.title}${titleSuffix}`;
            const kind = getScheduleKind(s);
            const kindLabel = getScheduleKindLabel(s);
            const isBookmarkNotice = s.id.startsWith('personal-bookmark-');

            return (
              <div
                key={s.id || idx}
                onClick={() => {
                  onClose();
                  onSelectSchedule(s);
                }}
                className="pt-2.5 first:pt-0 cursor-pointer group"
              >
                <div className="p-3 rounded-2xl bg-slate-50/80 hover:bg-slate-100/90 border border-slate-100 transition flex items-center justify-between gap-3 active:scale-98">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <ScheduleTypeIcon kind={kind} bgColor={badgeColor} size="sm" className="mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.2 rounded-md text-white"
                          style={{ backgroundColor: badgeColor }}
                        >
                          {kindLabel}
                        </span>
                        {isBookmarkNotice && (
                          <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1 py-0.2 rounded">
                            공지
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400 font-medium truncate">
                          {s.isAllDay || (!s.startTime && !s.endTime)
                            ? '하루 종일'
                            : `${s.startTime || '00:00'} ~ ${s.endTime || '00:00'}`}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 group-hover:text-dongseo-700 transition leading-snug break-keep">
                        {displayTitle}
                      </h4>
                      {isMultiDay && (
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          기간: {s.startDate} ~ {fixedEndDate}
                        </p>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition shrink-0" />
                </div>
              </div>
            );
          })}
        </div>

        {/* 하단 버튼 */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between gap-2">
          {onOpenAddModal && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAddModal(dateStr);
              }}
              className="flex-1 py-2 px-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-2xs active:scale-98"
            >
              <Plus className="w-3.5 h-3.5 text-dongseo-700" />
              <span>새 일정 추가</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 bg-dongseo-700 hover:bg-dongseo-800 text-white text-xs font-bold rounded-xl transition shadow-2xs active:scale-98"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
