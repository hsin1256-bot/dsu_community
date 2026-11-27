'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Header from '@/components/Header';
import { Loader2, Plus, RotateCw } from 'lucide-react';
import {
  CustomSchedule,
  MonthData,
  MIN_SUPPORTED_YEAR,
  MAX_SUPPORTED_YEAR,
} from './types';
import { formatDate, filterSchedulesForDate } from './utils';
import CalendarGrid from './components/CalendarGrid';
import MonthPickerModal from './components/MonthPickerModal';
import AddScheduleModal from './components/AddScheduleModal';
import ScheduleDetailModal from './components/ScheduleDetailModal';

const PERSONAL_STORAGE_KEY = 'dsu_personal_schedules';

function loadPersonalSchedules(): CustomSchedule[] {
  try {
    const raw = localStorage.getItem(PERSONAL_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((s) => s && typeof s.id === 'string' && s.id.startsWith('personal-')) : [];
  } catch {
    return [];
  }
}

function savePersonalSchedules(list: CustomSchedule[]) {
  try {
    localStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('개인 일정 저장 실패', e);
  }
}

function formatSyncedAt(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function SchedulePage() {
  // 학교 학사일정(DB)과 개인 일정(localStorage)을 따로 관리 → 한쪽이 실패해도 다른 쪽은 항상 보임
  const [academicSchedules, setAcademicSchedules] = useState<CustomSchedule[]>([]);
  const [personalSchedules, setPersonalSchedules] = useState<CustomSchedule[]>([]);
  const schedules = useMemo(() => [...academicSchedules, ...personalSchedules], [academicSchedules, personalSchedules]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);
  const [buttonCooldown, setButtonCooldown] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  // 선택된 특정 날짜
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => formatDate(new Date()));

  // 현재 보고 있는 년도 및 월 (기본값: 오늘 날짜 기준)
  const [currentYear, setCurrentYear] = useState<number>(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(() => new Date().getMonth()); // 0 ~ 11

  // 년/월 선택 모달 상태
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState<number>(() => new Date().getFullYear());

  // 📝 개인 일정 추가/수정 모달 상태
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<CustomSchedule | null>(null);

  // 🔍 클릭한 일정 상세 보기 모달 상태
  const [selectedScheduleDetail, setSelectedScheduleDetail] = useState<CustomSchedule | null>(null);

  const showToast = (message: string) => {
    setSyncToast(message);
    setTimeout(() => setSyncToast(null), 3000);
  };

  // 📥 학사일정 불러오기: DB 만 조회 (학교 사이트 크롤링은 서버 예약 동기화가 하루 1번 수행)
  const fetchSchedule = async (manual = false) => {
    if (manual) setIsSyncing(true);
    try {
      const res = await fetch(`/api/schedule?from=${MIN_SUPPORTED_YEAR}&to=${MAX_SUPPORTED_YEAR}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || '학사일정을 불러오지 못했습니다.');
      // 응답이 비어 있어도 기존 화면을 지우지 않음
      if (json.data.length > 0) setAcademicSchedules(json.data);
      setLastSyncedAt(json.syncedAt);
      if (manual) showToast(json.syncedAt ? `학사일정 업데이트: ${formatSyncedAt(json.syncedAt)}` : '학사일정을 다시 불러왔습니다.');
    } catch (err) {
      console.error(err);
      showToast('학사일정을 불러오지 못했습니다. 저장된 개인 일정만 표시합니다.');
    } finally {
      setLoading(false);
      if (manual) setIsSyncing(false);
    }
  };

  // 새로고침 버튼 10초 쿨다운 카운트다운 타이머
  useEffect(() => {
    if (buttonCooldown <= 0) return;
    const timer = setInterval(() => {
      setButtonCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [buttonCooldown]);

  useEffect(() => {
    setPersonalSchedules(loadPersonalSchedules());
    fetchSchedule();

    const reloadPersonalSchedules = () => {
      setPersonalSchedules(loadPersonalSchedules());
    };
    window.addEventListener('dsu_personal_schedules_updated', reloadPersonalSchedules);
    window.addEventListener('dsu_bookmarks_updated', reloadPersonalSchedules);
    window.addEventListener('storage', reloadPersonalSchedules);

    return () => {
      window.removeEventListener('dsu_personal_schedules_updated', reloadPersonalSchedules);
      window.removeEventListener('dsu_bookmarks_updated', reloadPersonalSchedules);
      window.removeEventListener('storage', reloadPersonalSchedules);
    };
  }, []);

  // 현재 선택된 월의 셀 데이터 계산
  const currentMonthData = useMemo(() => {
    const y = currentYear;
    const m = currentMonth;
    const firstDayOfWeek = new Date(y, m, 1).getDay();
    const lastDateOfMonth = new Date(y, m + 1, 0).getDate();
    const prevMonthLastDate = new Date(y, m, 0).getDate();

    const cells = [];

    // 이전 달 날짜 채우기
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDate - i;
      const prevMonthDate = new Date(y, m - 1, d);
      const dateStr = formatDate(prevMonthDate);
      cells.push({
        dateNumber: d,
        dateStr,
        isCurrentMonth: false,
        schedules: filterSchedulesForDate(dateStr, schedules),
      });
    }

    // 현재 달 날짜 채우기
    for (let d = 1; d <= lastDateOfMonth; d++) {
      const thisDate = new Date(y, m, d);
      const dateStr = formatDate(thisDate);
      cells.push({
        dateNumber: d,
        dateStr,
        isCurrentMonth: true,
        schedules: filterSchedulesForDate(dateStr, schedules),
      });
    }

    // 다음 달 날짜 채우기 (총 셀 수가 7의 배수가 되도록)
    const totalCells = cells.length;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let d = 1; d <= remaining; d++) {
      const nextMonthDate = new Date(y, m + 1, d);
      const dateStr = formatDate(nextMonthDate);
      cells.push({
        dateNumber: d,
        dateStr,
        isCurrentMonth: false,
        schedules: filterSchedulesForDate(dateStr, schedules),
      });
    }

    return {
      year: y,
      month: m,
      label: `${y}년 ${m + 1}월`,
      cells,
    };
  }, [currentYear, currentMonth, schedules]);

  // 오늘 날짜로 즉시 이동
  const scrollToToday = () => {
    const today = new Date();
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDateStr(formatDate(today));
  };

  // 년/월 팝업 열기
  const handleOpenMonthPicker = () => {
    setPickerYear(currentYear);
    setIsMonthPickerOpen(true);
  };

  // 월 선택 팝업에서 특정 월 클릭 시
  const handleSelectMonth = (monthIdx: number) => {
    setCurrentYear(pickerYear);
    setCurrentMonth(monthIdx);
    setIsMonthPickerOpen(false);
  };

  // 개인 일정 추가 모달 열기
  const handleOpenAddModal = () => {
    setEditingSchedule(null);
    setIsAddModalOpen(true);
  };

  // 개인 일정 수정 모달 열기
  const handleOpenEditModal = (schedule: CustomSchedule) => {
    if (!schedule.id.startsWith('personal-')) return;
    setEditingSchedule(schedule);
    setSelectedScheduleDetail(null);
    setIsAddModalOpen(true);
  };

  // 개인 일정 저장 (localStorage)
  const handleSaveSchedule = (data: {
    id?: string;
    title: string;
    startDate: string;
    endDate: string;
    startTime?: string;
    endTime?: string;
    isAllDay: boolean;
    color: string;
    memo: string;
  }) => {
    const fields = {
      title: data.title,
      startDate: data.startDate,
      endDate: data.endDate < data.startDate ? data.startDate : data.endDate,
      startTime: data.startTime,
      endTime: data.endTime,
      isAllDay: data.isAllDay,
      color: data.color,
      memo: data.memo,
    };
    const updated: CustomSchedule[] = data.id
      ? personalSchedules.map((s) => (s.id === data.id ? { ...s, ...fields } : s))
      : [...personalSchedules, { id: `personal-${Date.now()}`, category: '개인일정', ...fields }];

    setPersonalSchedules(updated);
    savePersonalSchedules(updated);
  };

  // 개인 일정 삭제
  const handleDeleteSchedule = (id: string) => {
    if (!id.startsWith('personal-')) return;
    if (!confirm('정말 이 일정을 삭제하시겠습니까?')) return;

    const updated = personalSchedules.filter((s) => s.id !== id);
    setPersonalSchedules(updated);
    savePersonalSchedules(updated);
    setSelectedScheduleDetail(null);
  };

  return (
    <main className="h-screen bg-white flex flex-col overflow-hidden pb-16">
      <Header title="학사일정" />

      <div className="flex-1 flex flex-col max-w-[480px] mx-auto w-full overflow-hidden">
        {/* 상단 서브바: 오늘로 이동 & ➕ 일정 추가 버튼 */}
        <div className="bg-white/95 backdrop-blur-md z-20 border-b border-slate-100 px-4 py-1.5 shrink-0 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-400">학사 캘린더</span>

          <div className="flex items-center gap-1.5">
            {/* 🔄 수동 즉시 새로고침 버튼 (10초 UI 쿨다운) */}
            <button
              onClick={() => {
                if (isSyncing || buttonCooldown > 0) return;
                setButtonCooldown(10);
                fetchSchedule(true);
              }}
              disabled={isSyncing || buttonCooldown > 0}
              className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-90 text-slate-600 flex items-center justify-center transition disabled:opacity-50 text-[11px] font-bold"
              title={
                buttonCooldown > 0
                  ? `${buttonCooldown}초 후 새로고침 가능`
                  : lastSyncedAt
                    ? `학사일정 업데이트: ${formatSyncedAt(lastSyncedAt)}`
                    : '학사일정 다시 불러오기'
              }
              aria-label="학사일정 다시 불러오기"
            >
              {buttonCooldown > 0 ? (
                <span className="text-[11px] font-semibold text-slate-400">{buttonCooldown}</span>
              ) : (
                <RotateCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-dongseo-700' : ''}`} />
              )}
            </button>

            <button
              onClick={scrollToToday}
              className="text-xs font-bold text-dongseo-700 bg-dongseo-50 hover:bg-dongseo-100 active:scale-95 px-3 py-1 rounded-full transition shadow-xs"
            >
              오늘로 이동
            </button>

            {/* ➕ 개인 일정 추가 버튼 */}
            <button
              onClick={handleOpenAddModal}
              className="w-7 h-7 rounded-full bg-dongseo-700 hover:bg-dongseo-800 active:scale-90 text-white flex items-center justify-center transition shadow-sm"
              title="개인 일정 추가"
              aria-label="일정 추가"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* 🔔 최신화 알림 토스트 배너 */}
        {syncToast && (
          <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg backdrop-blur-md transition-all animate-fade-in pointer-events-none">
            {syncToast}
          </div>
        )}

        {/* 📱 스크롤 없이 단일 월 표시 & 년/월 클릭 시 커스텀 휠 피커로 이동 */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-dongseo-700 mb-2" />
            <span className="text-xs font-medium">학사일정을 불러오는 중...</span>
          </div>
        ) : (
          <div className="flex-1 flex flex-col px-3 pt-2 pb-1 overflow-hidden">
            <CalendarGrid
              monthData={currentMonthData}
              selectedDateStr={selectedDateStr}
              currentYear={currentYear}
              currentMonth={currentMonth}
              minYear={MIN_SUPPORTED_YEAR}
              maxYear={MAX_SUPPORTED_YEAR}
              onSelectDate={setSelectedDateStr}
              onSelectSchedule={setSelectedScheduleDetail}
              onPrevMonth={() => {
                if (currentMonth === 0) {
                  if (currentYear > MIN_SUPPORTED_YEAR) {
                    setCurrentYear(currentYear - 1);
                    setCurrentMonth(11);
                  }
                } else {
                  setCurrentMonth(currentMonth - 1);
                }
              }}
              onNextMonth={() => {
                if (currentMonth === 11) {
                  if (currentYear < MAX_SUPPORTED_YEAR) {
                    setCurrentYear(currentYear + 1);
                    setCurrentMonth(0);
                  }
                } else {
                  setCurrentMonth(currentMonth + 1);
                }
              }}
              onOpenMonthPicker={handleOpenMonthPicker}
            />
          </div>
        )}
      </div>

      {/* 📅 년도 및 월 선택 모달 */}
      <MonthPickerModal
        isOpen={isMonthPickerOpen}
        onClose={() => setIsMonthPickerOpen(false)}
        pickerYear={pickerYear}
        setPickerYear={setPickerYear}
        currentYear={currentYear}
        currentMonth={currentMonth}
        onSelectMonth={handleSelectMonth}
        onScrollToToday={scrollToToday}
      />

      {/* 📱 개인 일정 추가/수정 모달 */}
      <AddScheduleModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        editingSchedule={editingSchedule}
        defaultDateStr={selectedDateStr}
        onSave={handleSaveSchedule}
      />

      {/* 🔍 일정 상세 보기 모달 */}
      <ScheduleDetailModal
        schedule={selectedScheduleDetail}
        onClose={() => setSelectedScheduleDetail(null)}
        onOpenEdit={handleOpenEditModal}
        onDelete={handleDeleteSchedule}
      />
    </main>
  );
}
