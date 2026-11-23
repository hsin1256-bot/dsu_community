/**
 * 동서대학교 글로벌빌리지(학생생활관) 주간식단표 이미지 크롤러
 * 대상: https://uni.dongseo.ac.kr/dormitory/index.php?pCode=MN5000024
 * 업데이트 주기: 매주 금요일 12:00 ~ 15:00
 *
 * 실행: node scripts/crawl-gv-menu.mjs
 */
import fs from 'fs';
import path from 'path';

const BOARD_URL = 'https://uni.dongseo.ac.kr/dormitory/index.php?pCode=MN5000024';
const BASE_ORIGIN = 'https://uni.dongseo.ac.kr';
const DATA_DIR = path.join(process.cwd(), 'data');

async function main() {
  console.log(`[GV-Crawler] 식단표 페이지 크롤링 시작: ${BOARD_URL}`);
  const res = await fetch(BOARD_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const html = await res.text();
  const imgRegex = /<img[^>]+src=["'](\/_Data\/SiteFiles\/dormitory\/[^"']+)["'][^>]*>/gi;
  const images = [];
  let m;
  while ((m = imgRegex.exec(html)) !== null) {
    const absUrl = `${BASE_ORIGIN}${m[1]}`;
    if (!images.includes(absUrl)) images.push(absUrl);
  }

  if (images.length === 0) {
    console.log('[GV-Crawler] 식단표 이미지를 찾지 못했습니다.');
    return;
  }

  // 주간식단표 이미지 (보통 2번째 이미지)
  const targetUrl = images.length >= 2 ? images[images.length - 1] : images[0];
  console.log(`[GV-Crawler] 주간식단표 이미지 발견: ${targetUrl}`);

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const imgRes = await fetch(targetUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0', Referer: BOARD_URL },
  });
  if (imgRes.ok) {
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const outPath = path.join(DATA_DIR, 'gv-latest-menu.png');
    fs.writeFileSync(outPath, buf);
    console.log(`[GV-Crawler] 최신 식단표 이미지 저장 완료: ${outPath} (${buf.length} bytes)`);
  }
}

main().catch((err) => {
  console.error('[GV-Crawler] 오류:', err);
  process.exit(1);
});
