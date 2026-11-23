export const DSU_BASE_URL = 'https://www.dongseo.ac.kr';

export const DSU_USER_AGENT =
  'Mozilla/5.0 (compatible; DSUCampusApp/1.0; +https://github.com/hsin1256-bot/dsu_community)';

/** 상대 경로를 학교 사이트 절대 URL 로 변환 */
export function toAbsoluteUrl(href: string): string {
  if (!href) return DSU_BASE_URL;
  if (/^https?:\/\//.test(href)) return href;
  return `${DSU_BASE_URL}${href.startsWith('/') ? '' : '/'}${href.replace(/&amp;/g, '&')}`;
}
