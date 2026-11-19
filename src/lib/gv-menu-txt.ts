import fs from 'fs';
import path from 'path';
import { CafeteriaMenu } from '@/types';

export const GV_BOARD_URL = 'https://uni.dongseo.ac.kr/dormitory/index.php?pCode=MN5000024';
export const GV_PRICE_LABEL = '의무식 5,000원 / 일반 6,000원';
export const GV_TXT_PATH = path.join(process.cwd(), 'data', 'gv-weekly-menu.txt');

export interface GvWeeklyMeta {
  sourceUrl: string;
  imageUrl: string;
  period: string;
  priceInfo: string;
  updateSchedule: string;
}

export function readGvWeeklyMenuTxt(): { meta: GvWeeklyMeta; menus: CafeteriaMenu[]; rawText: string } {
  const defaultMeta: GvWeeklyMeta = {
    sourceUrl: GV_BOARD_URL,
    imageUrl: '',
    period: '',
    priceInfo: GV_PRICE_LABEL,
    updateSchedule: '매주 금요일 12:00 ~ 15:00',
  };

  if (!fs.existsSync(GV_TXT_PATH)) {
    return { meta: defaultMeta, menus: [], rawText: '' };
  }

  const rawText = fs.readFileSync(GV_TXT_PATH, 'utf-8');
  const lines = rawText.split(/\r?\n/);

  const meta: GvWeeklyMeta = { ...defaultMeta };
  const menus: CafeteriaMenu[] = [];
  let currentDay = '';
  let dayIdx = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // 메타 헤더 파싱
    if (line.startsWith('#')) {
      if (line.includes('출처:')) meta.sourceUrl = line.split('출처:')[1].trim();
      else if (line.includes('원본 이미지:')) meta.imageUrl = line.split('원본 이미지:')[1].trim();
      else if (line.includes('기간:')) meta.period = line.split('기간:')[1].trim();
      else if (line.includes('가격:')) meta.priceInfo = line.split('가격:')[1].trim();
      else if (line.includes('업데이트 주기:')) meta.updateSchedule = line.split('업데이트 주기:')[1].trim();
      continue;
    }

    // 요일 헤더: [11월 19일(목)]
    const dayMatch = line.match(/^\[(.+)\]$/);
    if (dayMatch) {
      currentDay = dayMatch[1].trim();
      dayIdx += 1;
      continue;
    }

    // 식단 라인: 중식: 메뉴1, 메뉴2, ...
    if (currentDay && line.includes(':')) {
      const colonIdx = line.indexOf(':');
      const slot = line.slice(0, colonIdx).trim(); // 중식, 석식, Take-Out
      const itemsStr = line.slice(colonIdx + 1).trim();
      const items = itemsStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      if (items.length === 0) continue;

      const slotKey =
        slot === '중식' ? 'lunch' : slot === '석식' ? 'dinner' : 'takeout';

      menus.push({
        id: `gv-w${dayIdx}-${slotKey}`,
        restaurant: '글빌 식당',
        category: currentDay,
        name: `[${slot}] ${items[0]}`,
        cornerName: slot,
        menuItems: items,
        price: GV_PRICE_LABEL,
        rating: 0,
        reviewCount: 0,
      });
    }
  }

  return { meta, menus, rawText };
}

export async function crawlLatestGvMenuImage(): Promise<{
  boardUrl: string;
  imageUrls: string[];
  weeklyMenuImageUrl: string | null;
  hasNewImage: boolean;
}> {
  const res = await fetch(GV_BOARD_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch dormitory menu page: HTTP ${res.status}`);
  }

  const html = await res.text();
  const imgRegex = /<img[^>]+src=["'](\/_Data\/SiteFiles\/dormitory\/[^"']+)["'][^>]*>/gi;
  const imageUrls: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = imgRegex.exec(html)) !== null) {
    const absUrl = `https://uni.dongseo.ac.kr${m[1]}`;
    if (!imageUrls.includes(absUrl)) {
      imageUrls.push(absUrl);
    }
  }

  // 두 번째 이미지(또는 마지막 이미지)가 실제 주간식단표 이미지
  const weeklyMenuImageUrl =
    imageUrls.length >= 2 ? imageUrls[imageUrls.length - 1] : imageUrls[0] || null;

  const { meta } = readGvWeeklyMenuTxt();
  const hasNewImage = Boolean(weeklyMenuImageUrl && weeklyMenuImageUrl !== meta.imageUrl);

  return {
    boardUrl: GV_BOARD_URL,
    imageUrls,
    weeklyMenuImageUrl,
    hasNewImage,
  };
}
