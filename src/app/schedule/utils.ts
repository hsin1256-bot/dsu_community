import { CustomSchedule } from './types';

// 🎨 일정 유형 분류: 북마크 일정, 학사일정, 개인일정
export type ScheduleKind = 'bookmark' | 'academic' | 'personal';

export function getScheduleKind(schedule: CustomSchedule): ScheduleKind {
  if (schedule.id.startsWith('personal-bookmark-') || schedule.category === '공지 북마크') {
    return 'bookmark';
  }
  if (schedule.id.startsWith('personal-')) {
    return 'personal';
  }
  return 'academic';
}

/**
 * 🏷️ 일정 종류별 이모티콘 매핑
 * - 북마크 일정: 🔖 (Bookmark Ribbon)
 * - 학사일정: 🎓 (Graduation Cap)
 * - 개인일정: 👤 (Person Profile)
 */
export function getScheduleEmoji(schedule: CustomSchedule): string {
  const kind = getScheduleKind(schedule);
  switch (kind) {
    case 'bookmark':
      return '🔖';
    case 'academic':
      return '🎓';
    case 'personal':
      return '👤';
  }
}

export function getScheduleKindLabel(schedule: CustomSchedule): string {
  const kind = getScheduleKind(schedule);
  switch (kind) {
    case 'bookmark':
      return '북마크 일정';
    case 'academic':
      return '학사일정';
    case 'personal':
      return '개인일정';
  }
}

// 🎨 유형별 기본 테마 컬러 (업로드된 디자인 기준: 북마크-파랑, 학사-보라, 개인-초록)
export const KIND_THEME_COLORS = {
  bookmark: '#0080FF', // 파란색 (북마크 일정)
  academic: '#9A25E2', // 보라색 (학사일정)
  personal: '#52C41A', // 초록색 (개인일정)
};

export const SCHEDULE_COLOR_PALETTE = [
  '#0080FF', // Blue
  '#9A25E2', // Purple
  '#52C41A', // Green
  '#9E1B32', // Dongseo Burgundy
  '#FF9500', // Orange
  '#00C7BE', // Teal
  '#FF2D55', // Pink
  '#5AC8FA', // Sky Blue
];

export function getScheduleColor(schedule: CustomSchedule): string {
  if (schedule.color) return schedule.color;
  const kind = getScheduleKind(schedule);
  return KIND_THEME_COLORS[kind];
}

// "13:00" -> { ampm: '오후', hour: 1, minute: '00' }
export function parseTimeToAmPm(timeStr: string) {
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr || '12', 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? '오후' : '오전';
  let displayHour = h % 12;
  if (displayHour === 0) displayHour = 12;
  return { ampm, hour: displayHour, minute: m };
}

// { ampm: '오후', hour: 1, minute: '00' } -> "13:00"
export function composeTimeFromAmPm(ampm: string, hour: number, minute: string) {
  let h = hour;
  if (ampm === '오후' && h < 12) h += 12;
  if (ampm === '오전' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${minute}`;
}

export function formatKoreanTimeDisplay(timeStr: string) {
  const { ampm, hour, minute } = parseTimeToAmPm(timeStr);
  return `${ampm} ${hour}:${minute}`;
}

export function formatKoreanDateDisplay(dateStr: string) {
  const [y, m, d] = dateStr.split('-');
  return `${y}. ${parseInt(m, 10)}. ${parseInt(d, 10)}.`;
}

export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function shiftDateByMonth(dateStr: string, monthDelta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1 + monthDelta, 1);
  const lastDate = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const clampedDay = Math.min(d, lastDate);
  const finalDate = new Date(target.getFullYear(), target.getMonth(), clampedDay);
  return formatDate(finalDate);
}

// 📅 특정 날짜에 해당하는 일정 필터링
// (캘린더에는 첫일(시작일)과 마지막 일(종료일)만 표시)
export function filterSchedulesForDate(dateStr: string, schedules: CustomSchedule[]) {
  return schedules.filter((s) => {
    const fixedEndDate = s.endDate && s.endDate >= s.startDate ? s.endDate : s.startDate;
    if (s.startDate === fixedEndDate) {
      return dateStr === s.startDate;
    }
    // 첫일과 마지막 일만 일정에 표시
    return dateStr === s.startDate || dateStr === fixedEndDate;
  });
}
