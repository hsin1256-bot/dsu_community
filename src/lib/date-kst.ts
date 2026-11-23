/**
 * 한국 표준시(Asia/Seoul) 기준 날짜 유틸.
 * `new Date().toISOString()` 은 UTC 라서 KST 오전 0~9시에는 하루 전 날짜가 나오므로 사용하지 않습니다.
 */

const KST_DATE_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** KST 기준 YYYY-MM-DD */
export function todayKST(date: Date = new Date()): string {
  return KST_DATE_FORMAT.format(date);
}

/** KST 기준 연도 */
export function currentYearKST(date: Date = new Date()): number {
  return Number(todayKST(date).slice(0, 4));
}

/** KST 기준 월 (1~12) */
export function currentMonthKST(date: Date = new Date()): number {
  return Number(todayKST(date).slice(5, 7));
}

/**
 * 현재 학년도/학기.
 * - 3~8월: 그해 1학기
 * - 9~12월: 그해 2학기
 * - 1~2월: 직전 학년도 2학기 (겨울방학)
 */
export function currentSemesterKST(date: Date = new Date()): { academicYear: number; semester: '1학기' | '2학기' } {
  const year = currentYearKST(date);
  const month = currentMonthKST(date);
  if (month >= 3 && month <= 8) return { academicYear: year, semester: '1학기' };
  if (month >= 9) return { academicYear: year, semester: '2학기' };
  return { academicYear: year - 1, semester: '2학기' };
}

/** YYYY-MM-DD 두 날짜 사이의 일수 (to - from) */
export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86400000);
}
