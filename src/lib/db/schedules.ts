import { AcademicSchedule } from '@/types';
import { supabase, isSupabaseConfigured, getSupabaseAdmin } from '@/lib/supabase-client';

/**
 * academic_schedules 테이블 접근 (서버 전용).
 * 화면/API 는 DB 만 읽고, 학교 사이트 크롤링은 예약 동기화(/api/sync)에서만 합니다.
 */

type ScheduleRow = {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  category: AcademicSchedule['category'];
  is_important: boolean | null;
};

const fromRow = (r: ScheduleRow): AcademicSchedule => ({
  id: r.id,
  title: r.title,
  startDate: r.start_date,
  endDate: r.end_date,
  category: r.category,
  isImportant: Boolean(r.is_important),
});

/** fromYear~toYear 에 시작하는 일정 + 마지막 동기화 시각 (start_date 범위로 DB 에서 바로 필터) */
export async function getSchedulesByYearRange(
  fromYear: number,
  toYear: number
): Promise<{ data: AcademicSchedule[]; syncedAt: string | null }> {
  if (!isSupabaseConfigured || !supabase) return { data: [], syncedAt: null };
  const [list, latest] = await Promise.all([
    supabase
      .from('academic_schedules')
      .select('id,title,start_date,end_date,category,is_important')
      .gte('start_date', `${fromYear}-01-01`)
      .lte('start_date', `${toYear}-12-31`)
      .order('start_date', { ascending: true }),
    supabase.from('academic_schedules').select('last_seen_at').order('last_seen_at', { ascending: false }).limit(1),
  ]);
  if (list.error) {
    console.error('[schedules] fetch error:', list.error.message);
    throw new Error('학사일정을 불러오지 못했습니다.');
  }
  return {
    data: (list.data as ScheduleRow[]).map(fromRow),
    syncedAt: (latest.data?.[0]?.last_seen_at as string | undefined) ?? null,
  };
}

/** 오늘 이후 다가오는 일정 (홈 화면용) */
export async function getUpcomingSchedules(fromDate: string, limit = 4, importantOnly = true): Promise<AcademicSchedule[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  let qb = supabase
    .from('academic_schedules')
    .select('id,title,start_date,end_date,category,is_important')
    .gte('end_date', fromDate)
    .order('start_date', { ascending: true })
    .limit(limit);
  if (importantOnly) qb = qb.eq('is_important', true);
  const { data, error } = await qb;
  if (error) {
    console.error('[schedules] upcoming error:', error.message);
    return [];
  }
  return (data as ScheduleRow[]).map(fromRow);
}

/**
 * 크롤링한 1년치 일정으로 DB 를 맞춥니다 (service role 전용).
 * 1) upsert 하면서 last_seen_at 갱신
 * 2) 그 연도에서 이번에 보이지 않은 행 삭제 → 학교에서 지운 일정이 앱에 남지 않음
 */
export async function replaceSchedulesForYear(year: number, schedules: AcademicSchedule[]): Promise<{ saved: number; removed: number }> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('SUPABASE_SERVICE_ROLE_KEY 가 없어 학사일정을 저장할 수 없습니다.');
  if (!schedules.length) throw new Error('저장할 일정이 없습니다. (빈 결과로 기존 데이터를 지우지 않음)');

  const syncedAt = new Date().toISOString();
  const rows = schedules.map((s) => ({
    id: s.id,
    title: s.title,
    start_date: s.startDate,
    end_date: s.endDate,
    category: s.category,
    is_important: s.isImportant ?? false,
    last_seen_at: syncedAt,
  }));

  const { error: upsertError } = await admin.from('academic_schedules').upsert(rows, { onConflict: 'id' });
  if (upsertError) throw new Error(`학사일정 저장 실패: ${upsertError.message}`);

  const { data: removed, error: deleteError } = await admin
    .from('academic_schedules')
    .delete()
    .gte('start_date', `${year}-01-01`)
    .lte('start_date', `${year}-12-31`)
    .lt('last_seen_at', syncedAt)
    .select('id');
  if (deleteError) throw new Error(`사라진 일정 정리 실패: ${deleteError.message}`);

  return { saved: rows.length, removed: removed?.length ?? 0 };
}
