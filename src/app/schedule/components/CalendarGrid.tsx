'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MonthData, CustomSchedule, WEEKDAYS } from '../types';
import { getScheduleColor, getScheduleKind, getScheduleKindLabel, formatDate } from '../utils';
import ScheduleTypeIcon from './ScheduleTypeIcon';

interface CalendarGridProps {
  monthData: MonthData;
  selectedDateStr: string;
  currentYear: number;
  currentMonth: number;
  minYear: number;
  maxYear: number;
  onSelectDate: (dateStr: string) => void;
  onSelectSchedule: (schedule: CustomSchedule) => void;
  onOpenDaySchedules: (dateStr: string, schedules: CustomSchedule[]) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onOpenMonthPicker: () => void;
}

export default function CalendarGrid({
  monthData,
  selectedDateStr,
  currentYear,
  currentMonth,
  minYear,
  maxYear,
  onSelectDate,
  onSelectSchedule,
  onOpenDaySchedules,
  onPrevMonth,
  onNextMonth,
  onOpenMonthPicker,
}: CalendarGridProps) {
  const rowsCount = monthData.cells.length / 7;
  const todayDateStr = formatDate(new Date());

  const canPrev = currentMonth > 0 || currentYear > minYear;
  const canNext = currentMonth < 11 || currentYear < maxYear;

  return (
    <div className="h-full flex flex-col box-border">
      {/* 월 타이틀: 클릭 시 년도/달 선택 팝업 열림 */}
      <div className="py-1 shrink-0 px-1 flex items-center justify-between">
        <button
          type="button"
          onClick={onOpenMonthPicker}
          className="group flex items-center gap-1.5 py-1 px-2 -ml-2 rounded-xl hover:bg-slate-100 active:scale-95 transition"
        >
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-1">
            <span>{monthData.label}</span>
            <ChevronRight className="w-5 h-5 text-dongseo-700 group-hover:translate-x-0.5 transition-transform" />
          </h2>
        </button>

        {/* 이전 달 / 다음 달 이동 버튼 */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onPrevMonth}
            disabled={!canPrev}
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-xl hover:bg-slate-100 active:scale-90 transition disabled:opacity-30"
            title="이전 달"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={onNextMonth}
            disabled={!canNext}
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-xl hover:bg-slate-100 active:scale-90 transition disabled:opacity-30"
            title="다음 달"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 🏷️ 일정 종류 범례 (이미지 기반 원형 아이콘: 북마크 일정, 학사일정, 개인일정) */}
      <div className="flex items-center justify-center gap-4 py-1.5 px-3 bg-slate-50/90 rounded-xl border border-slate-100 text-[11px] font-bold text-slate-700 mb-1 shrink-0">
        <span className="flex items-center gap-1.5">
          <ScheduleTypeIcon kind="bookmark" size="sm" />
          <span>북마크 일정</span>
        </span>
        <span className="flex items-center gap-1.5">
          <ScheduleTypeIcon kind="academic" size="sm" />
          <span>학사일정</span>
        </span>
        <span className="flex items-center gap-1.5">
          <ScheduleTypeIcon kind="personal" size="sm" />
          <span>개인일정</span>
        </span>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 py-1 text-center shrink-0 border-b border-slate-100">
        {WEEKDAYS.map((day, idx) => (
          <span
            key={day}
            className={`text-xs font-bold ${
              idx === 0 ? 'text-rose-500' : idx === 6 ? 'text-blue-500' : 'text-slate-400'
            }`}
          >
            {day}
          </span>
        ))}
      </div>

      {/* 캘린더 그리드 셀 */}
      <div
        className="flex-1 grid grid-cols-7 pt-1"
        style={{
          gridTemplateRows: `repeat(${rowsCount}, minmax(0, 1fr))`,
        }}
      >
        {monthData.cells.map((cell, idx) => {
          const isSelected = cell.dateStr === selectedDateStr;
          const isToday = cell.dateStr === todayDateStr;
          const hasEvents = cell.schedules.length > 0;

          return (
            <div
              key={idx}
              role="button"
              tabIndex={0}
              onClick={() => onSelectDate(cell.dateStr)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectDate(cell.dateStr);
                }
              }}
              className={`flex flex-col items-center justify-start pt-1 pb-1 transition-all duration-150 relative cursor-pointer select-none ${
                isSelected
                  ? 'bg-dongseo-700/10 rounded-xl font-bold'
                  : isToday
                  ? 'bg-dongseo-50 font-extrabold'
                  : cell.isCurrentMonth
                  ? 'text-slate-800 hover:bg-slate-50'
                  : 'text-slate-300 hover:bg-slate-50'
              }`}
            >
              {/* 날짜 숫자 */}
              <span
                className={`w-7 h-7 flex items-center justify-center text-sm font-semibold rounded-full leading-none mb-0.5 ${
                  isSelected
                    ? 'bg-dongseo-700 text-white font-extrabold shadow-sm'
                    : isToday
                    ? 'bg-dongseo-100 text-dongseo-800 font-extrabold'
                    : ''
                }`}
              >
                {cell.dateNumber}
              </span>

              {/* 일정 뱃지 (첫일과 마지막 일만 스마트 렌더링) */}
              <div className="w-full flex-1 flex flex-col gap-0.5 overflow-hidden">
                {hasEvents &&
                  cell.schedules.slice(0, 3).map((s, sIdx) => {
                    const badgeColor = getScheduleColor(s);
                    const fixedEndDate = s.endDate && s.endDate >= s.startDate ? s.endDate : s.startDate;
                    const isMultiDay = s.startDate !== fixedEndDate;
                    const isStartDay = cell.dateStr === s.startDate;
                    const isEndDay = cell.dateStr === fixedEndDate;

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

                    return (
                      <div
                        key={sIdx}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectSchedule(s);
                        }}
                        className="w-full mx-0.5 px-1 py-0.5 text-left flex items-center gap-1 leading-tight cursor-pointer hover:opacity-100 active:scale-95 transition-transform relative z-0 text-white h-4.5 min-h-[18px] text-[10px] font-bold rounded-md opacity-95"
                        style={{
                          backgroundColor: badgeColor,
                        }}
                        title={`[${getScheduleKindLabel(s)}] ${displayTitle}`}
                      >
                        <ScheduleTypeIcon kind={getScheduleKind(s)} bgColor={badgeColor} size="xs" />
                        <span className="truncate leading-none">
                          {displayTitle}
                        </span>
                      </div>
                    );
                  })}
                {cell.schedules.length > 3 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDaySchedules(cell.dateStr, cell.schedules);
                    }}
                    className={`w-full text-[8.5px] font-extrabold text-left px-1 py-0.5 mt-0.5 rounded transition flex items-center justify-between group active:scale-95 shadow-2xs cursor-pointer ${
                      isSelected
                        ? 'text-dongseo-800 bg-white/90 hover:bg-white'
                        : 'text-dongseo-700 bg-dongseo-50 hover:bg-dongseo-100 hover:text-dongseo-800'
                    }`}
                    title="전체 일정 보기"
                  >
                    <span>+{cell.schedules.length - 3}개 더보기</span>
                    <ChevronRight className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
