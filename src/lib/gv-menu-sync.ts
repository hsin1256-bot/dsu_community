import { createClient } from '@supabase/supabase-js';
import { supabase, supabaseUrl } from '@/lib/supabase-client';

export const GV_BOARD_URL = 'https://uni.dongseo.ac.kr/dormitory/index.php?pCode=MN5000024';
export const GV_PRICE_LABEL = '의무식 5,000원 / 일반 6,000원';

export interface ParsedGvDay {
  date: string; // e.g. "11월 23일(월)"
  lunch: string[];
  dinner: string[];
  takeout: string[];
}

export interface ParsedGvWeeklyMenu {
  period: string; // e.g. "11월 23일(월) ~ 11월 27일(금)"
  days: ParsedGvDay[];
}

export interface GvSyncState {
  restaurant: string;
  sourceUrl: string;
  lastImageUrl: string | null;
  period: string | null;
  lastSyncedAt: string | null;
}

function getServiceRoleClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.');
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function getGvSyncState(): Promise<GvSyncState | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('cafeteria_sync_state')
    .select('*')
    .eq('restaurant', '글빌 식당')
    .maybeSingle();

  if (error || !data) return null;
  return {
    restaurant: data.restaurant,
    sourceUrl: data.source_url,
    lastImageUrl: data.last_image_url,
    period: data.period,
    lastSyncedAt: data.last_synced_at,
  };
}

/**
 * 1단계: 동서대 학생생활관 식단표 페이지에서 최신 주간식단표 이미지 URL 크롤링
 */
export async function crawlLatestGvMenuImage(): Promise<{
  boardUrl: string;
  imageUrls: string[];
  weeklyMenuImageUrl: string | null;
}> {
  const res = await fetch(GV_BOARD_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`학생생활관 식단표 페이지 요청 실패: HTTP ${res.status}`);
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

  // 첫 번째 이미지는 상단 안내 배너, 마지막 이미지가 실제 주간식단표 이미지
  const weeklyMenuImageUrl =
    imageUrls.length >= 2 ? imageUrls[imageUrls.length - 1] : imageUrls[0] || null;

  return {
    boardUrl: GV_BOARD_URL,
    imageUrls,
    weeklyMenuImageUrl,
  };
}

/**
 * 2단계: 크롤링한 식단표 이미지를 메모리에서 바로 Gemini Vision으로 파싱 (텍스트 파일 저장 없음)
 */
export async function parseGvMenuImageWithGemini(imageUrl: string): Promise<ParsedGvWeeklyMenu> {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY 환경변수가 설정되지 않았습니다.');
  }

  const imgRes = await fetch(imageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Referer: GV_BOARD_URL,
    },
    cache: 'no-store',
  });
  if (!imgRes.ok) {
    throw new Error(`식단표 이미지 다운로드 실패: HTTP ${imgRes.status}`);
  }

  const mimeType = imgRes.headers.get('content-type')?.split(';')[0] || 'image/png';
  const base64Image = Buffer.from(await imgRes.arrayBuffer()).toString('base64');

  const prompt = `당신은 동서대학교 글로벌빌리지(학생생활관) 주간식단표 이미지를 정확하게 JSON으로 변환하는 파서입니다.
이미지 속 월요일~금요일 5일치 식단표를 읽고 아래 JSON 형식으로만 응답하세요.
메뉴 이름은 이미지에 적힌 한글 표기 그대로 정확하게 추출하세요.

{
  "period": "11월 16일(월) ~ 11월 20일(금)",
  "days": [
    {
      "date": "11월 16일(월)",
      "lunch": ["주메뉴", "국", "반찬1", "반찬2", "밥", "김치"],
      "dinner": ["주메뉴", "국", "반찬1", "반찬2", "밥", "김치"],
      "takeout": ["샌드위치*구운란", "음료 택 1"]
    }
  ]
}`;

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
                  data: base64Image,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!geminiRes.ok) {
    const errText = await geminiRes.text();
    throw new Error(`Gemini Vision 파싱 실패 (HTTP ${geminiRes.status}): ${errText.slice(0, 200)}`);
  }

  const geminiJson = await geminiRes.json();
  const rawText = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('Gemini Vision 응답에서 식단 JSON을 찾을 수 없습니다.');
  }

  const parsed = JSON.parse(rawText) as ParsedGvWeeklyMenu;
  if (!Array.isArray(parsed.days) || parsed.days.length === 0) {
    throw new Error('파싱된 요일별 식단 데이터가 비어 있습니다.');
  }

  return parsed;
}

/**
 * 3단계: 크롤링 -> 이미지 파싱 -> Supabase cafeteria_menus 즉시 업데이트 (텍스트 파일 미사용)
 */
export async function syncGvWeeklyMenuToSupabase(options?: { force?: boolean }) {
  const force = Boolean(options?.force);
  const currentState = await getGvSyncState();
  const crawl = await crawlLatestGvMenuImage();

  if (!crawl.weeklyMenuImageUrl) {
    return {
      updated: false,
      reason: 'no_image_found',
      message: '식단표 페이지에서 주간식단표 이미지를 찾지 못했습니다.',
    };
  }

  if (!force && currentState?.lastImageUrl === crawl.weeklyMenuImageUrl) {
    return {
      updated: false,
      reason: 'already_up_to_date',
      imageUrl: crawl.weeklyMenuImageUrl,
      period: currentState.period,
      message: '이미 최신 주간식단표가 Supabase DB에 반영되어 있습니다.',
    };
  }

  // 새 식단표 이미지를 메모리에서 바로 파싱
  const parsed = await parseGvMenuImageWithGemini(crawl.weeklyMenuImageUrl);
  const adminClient = getServiceRoleClient();

  const rows: Array<{
    id: string;
    restaurant: string;
    category: string;
    name: string;
    corner_name: string;
    price: string;
    menu_items: string[];
    sort_order: number;
  }> = [];

  let sortOrder = 1;
  parsed.days.forEach((day, idx) => {
    const dayNum = idx + 1;
    const slots: Array<{ key: string; label: string; items: string[] }> = [
      { key: 'lunch', label: '중식', items: day.lunch || [] },
      { key: 'dinner', label: '석식', items: day.dinner || [] },
      { key: 'takeout', label: 'Take-Out', items: day.takeout || [] },
    ];

    for (const slot of slots) {
      const cleaned = slot.items.map((s) => s.trim()).filter(Boolean);
      if (cleaned.length === 0) continue;
      rows.push({
        id: `gv-w${dayNum}-${slot.key}`,
        restaurant: '글빌 식당',
        category: day.date.trim(),
        name: `[${slot.label}] ${cleaned[0]}`,
        corner_name: slot.label,
        price: GV_PRICE_LABEL,
        menu_items: cleaned,
        sort_order: sortOrder++,
      });
    }
  });

  if (rows.length === 0) {
    throw new Error('변환된 글빌 식당 메뉴 행이 0건입니다.');
  }

  const { error: upsertErr } = await adminClient
    .from('cafeteria_menus')
    .upsert(rows, { onConflict: 'id' });

  if (upsertErr) {
    throw new Error(`Supabase cafeteria_menus 업데이트 실패: ${upsertErr.message}`);
  }

  const { error: stateErr } = await adminClient
    .from('cafeteria_sync_state')
    .upsert(
      {
        restaurant: '글빌 식당',
        source_url: GV_BOARD_URL,
        last_image_url: crawl.weeklyMenuImageUrl,
        period: parsed.period || `${parsed.days[0].date} ~ ${parsed.days[parsed.days.length - 1].date}`,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: 'restaurant' }
    );

  if (stateErr) {
    throw new Error(`Supabase cafeteria_sync_state 업데이트 실패: ${stateErr.message}`);
  }

  return {
    updated: true,
    reason: 'synced',
    imageUrl: crawl.weeklyMenuImageUrl,
    period: parsed.period,
    menuCount: rows.length,
    message: `글빌 식당 주간식단표(${parsed.period}, ${rows.length}건)가 Supabase DB에 자동 업데이트되었습니다.`,
  };
}
