/**
 * 학사일정 동기화 (예약 실행 전용: /api/sync 에서만 호출)
 * 작년·올해·내년 3개 연도를 학교 사이트에서 1번씩(m=all) 가져와 DB 에 반영합니다.
 */
import { scrapeDongseoSchedule } from '@/lib/dsu/schedule-crawler';
import { replaceSchedulesForYear } from '@/lib/db/schedules';
import { currentYearKST } from '@/lib/date-kst';

export interface ScheduleSyncResult {
  year: number;
  saved: number;
  removed: number;
  error?: string;
}

export function scheduleSyncYears(): number[] {
  const y = currentYearKST();
  return [y - 1, y, y + 1];
}

export async function runScheduleSync(years: number[] = scheduleSyncYears()): Promise<ScheduleSyncResult[]> {
  const results: ScheduleSyncResult[] = [];
  for (const year of years) {
    try {
      const items = await scrapeDongseoSchedule(year);
      results.push({ year, ...(await replaceSchedulesForYear(year, items)) });
    } catch (err) {
      // 실패한 연도는 기존 DB 데이터를 그대로 둡니다.
      results.push({ year, saved: 0, removed: 0, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return results;
}
