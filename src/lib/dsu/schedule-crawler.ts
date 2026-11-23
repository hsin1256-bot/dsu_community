import * as cheerio from 'cheerio';
import { createHash } from 'crypto';
import { AcademicSchedule } from '@/types';
import { DSU_BASE_URL, DSU_USER_AGENT } from './common';

/**
 * 학사일정 제목 정리.
 * - "2026-2학기 개강" → "2학기 개강" (연도만 제거, 학기 정보는 유지)
 * - "2027년 일학습병행 참가자 모집" 처럼 의미 있는 연도는 그대로 둠
 */
export function cleanScheduleTitle(rawTitle: string): string {
  const title = rawTitle.replace(/\s+/g, ' ').trim();
  return title.replace(/^\d{2,4}\s*-\s*([12]학기|여름학기|겨울학기|계절학기)\s*/, '$1 ').trim() || title;
}

function classify(title: string): Pick<AcademicSchedule, 'category' | 'isImportant'> {
  let category: AcademicSchedule['category'] = '행사';
  if (/시험|고사/.test(title)) category = '시험';
  else if (/수업|성적|수강|개강|종강/.test(title)) category = '수강/성적';
  else if (/등록|장학/.test(title)) category = '등록/장학';
  else if (/휴학|복학|전과/.test(title)) category = '휴학/복학';

  const isImportant = /고사|등록금|개강|종강|수강신청/.test(title);
  return { category, isImportant };
}

type DatePart = { y: number; m: number; d: number };

function parseDatePart(part: string, defaultYear: number): DatePart | null {
  const y4 = part.match(/(\d{4})[.\-\s]+(\d{1,2})[.\-\s]+(\d{1,2})/);
  if (y4) return { y: +y4[1], m: +y4[2], d: +y4[3] };
  const md = part.match(/(\d{1,2})[.\-\s]+(\d{1,2})/);
  if (md) return { y: defaultYear, m: +md[1], d: +md[2] };
  return null;
}

const fmt = ({ y, m, d }: DatePart) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/**
 * 날짜 문자열 파싱. 예) "11. 09(월)", "11. 23(월) ~ 11. 24(화)", "12. 22(화) ~ 02. 26(금)"
 * 종료 월이 시작 월보다 작으면 다음 해로 계산합니다.
 */
export function parseScheduleDate(rawDate: string, year: number): { startDate: string; endDate: string } | null {
  const [startRaw, endRaw] = rawDate.split('~').map((s) => s.trim());
  const start = parseDatePart(startRaw, year);
  if (!start) return null;
  let end = endRaw ? parseDatePart(endRaw, year) : null;
  if (end && !/\d{4}/.test(endRaw) && (end.m < start.m || (end.m === start.m && end.d < start.d))) {
    end = { ...end, y: start.y + 1 };
  }
  const startDate = fmt(start);
  const endDate = end ? fmt(end) : startDate;
  return { startDate, endDate: endDate < startDate ? startDate : endDate };
}

/** 제목 전체 + 날짜로 만든 결정적 id (제목 앞 15자만 쓰던 방식은 충돌 위험이 있었음) */
function stableScheduleId(title: string, startDate: string, endDate: string): string {
  const hash = createHash('sha1').update(`${title}|${startDate}|${endDate}`).digest('hex').slice(0, 12);
  return `dsu-${startDate}-${hash}`;
}

/**
 * 학교 학사일정 1년치 크롤링 (요청 1번: m=all).
 * 실패하거나 0건이면 예외를 던집니다. → 호출한 쪽에서 기존 DB 데이터를 유지할 수 있음.
 */
export async function scrapeDongseoSchedule(year: number): Promise<AcademicSchedule[]> {
  const url = `${DSU_BASE_URL}/kr/index.php?pCode=dscalendar&mode=listall&y=${year}&m=all`;
  const res = await fetch(url, {
    headers: { 'User-Agent': DSU_USER_AGENT },
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`학사일정 페이지 응답 오류 HTTP ${res.status}`);

  const $ = cheerio.load(await res.text());
  const seen = new Set<string>();
  const list: AcademicSchedule[] = [];

  $('.daily-li').each((_, el) => {
    const rawDate = $(el).find('.date-core').text().replace(/\s+/g, ' ').trim();
    const rawTitle = $(el).find('.body-core a.ptit').text();
    if (!rawDate || !rawTitle.trim()) return;

    const title = cleanScheduleTitle(rawTitle);
    const dates = parseScheduleDate(rawDate, year);
    if (!dates) return;

    const id = stableScheduleId(title, dates.startDate, dates.endDate);
    if (seen.has(id)) return;
    seen.add(id);

    list.push({ id, title, ...dates, ...classify(title) });
  });

  if (list.length === 0) {
    throw new Error(`${year}년 학사일정을 하나도 파싱하지 못했습니다. (페이지 구조 변경 가능성)`);
  }
  return list.sort((a, b) => a.startDate.localeCompare(b.startDate));
}
