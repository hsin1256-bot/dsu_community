/**
 * 동서대학교 사이트 크롤러 모음 (서버 전용).
 * - 공지: dsu/notice-crawler.ts
 * - 학사일정: dsu/schedule-crawler.ts
 * - 학식(글빌 식단표): gv-menu-txt.ts
 *
 * ⚠️ 크롤러는 실패 시 예외를 던집니다. 목업 데이터로 대체하지 않습니다.
 */
export * from './dsu/notice-crawler';
export * from './dsu/schedule-crawler';
