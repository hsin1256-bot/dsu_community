/**
 * 동서대학교 글로벌빌리지(학생생활관) 주간식단표 자동 크롤링 & Supabase 즉시 업데이트 스크립트
 * - 텍스트(.txt) 파일로 저장하지 않고 메모리에서 바로 파싱하여 Supabase DB를 갱신합니다.
 * - GitHub Actions (.github/workflows/sync-gv-menu.yml)에서 매주 금요일 12:30 / 14:00 / 15:30 KST 자동 실행
 *
 * 수동 실행:
 *   node scripts/crawl-gv-menu.mjs [--force]
 *
 * 필요 환경변수:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   GEMINI_API_KEY
 */
import { createClient } from '@supabase/supabase-js';

const BOARD_URL = 'https://uni.dongseo.ac.kr/dormitory/index.php?pCode=MN5000024';
const BASE_ORIGIN = 'https://uni.dongseo.ac.kr';
const GV_PRICE_LABEL = '의무식 5,000원 / 일반 6,000원';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const geminiApiKey = process.env.GEMINI_API_KEY || '';
const force = process.argv.includes('--force');

if (!supabaseUrl || !serviceRoleKey) {
  console.error('[GV-Sync] NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.');
  process.exit(1);
}
if (!geminiApiKey) {
  console.error('[GV-Sync] 식단표 이미지 자동 파싱을 위해 GEMINI_API_KEY가 필요합니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function crawlWeeklyImageUrl() {
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

  return images.length >= 2 ? images[images.length - 1] : images[0] || null;
}

async function parseMenuImage(imageUrl) {
  const imgRes = await fetch(imageUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0', Referer: BOARD_URL },
  });
  if (!imgRes.ok) throw new Error(`이미지 다운로드 실패: HTTP ${imgRes.status}`);

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

  const bodyStr = JSON.stringify({
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: base64Image } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
    },
  });

  // 우선순위 모델 목록 + 실패 시 사용 가능한 Gemini 모델 동적 탐색
  const preferredModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3-flash-preview'];
  let candidateModels = [...preferredModels];
  try {
    const listRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(geminiApiKey)}`
    );
    if (listRes.ok) {
      const listJson = await listRes.json();
      const discovered = (listJson.models || [])
        .filter(
          (m) =>
            Array.isArray(m.supportedGenerationMethods) &&
            m.supportedGenerationMethods.includes('generateContent') &&
            typeof m.name === 'string' &&
            /gemini.*flash/i.test(m.name) &&
            !/tts|image|audio|thinking|live|embedding/i.test(m.name)
        )
        .map((m) => m.name.replace(/^models\//, ''));
      for (const dm of discovered) {
        if (!candidateModels.includes(dm)) candidateModels.push(dm);
      }
      console.log('[GV-Sync] 후보 모델 목록:', candidateModels.slice(0, 6).join(', '));
    }
  } catch {
    // 모델 목록 조회 실패 시 기본 목록 사용
  }

  let lastErr = '';

  for (const model of candidateModels.slice(0, 6)) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiApiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: bodyStr,
        }
      );

      if (geminiRes.ok) {
        console.log(`[GV-Sync] ${model} 모델로 이미지 파싱 성공!`);
        const json = await geminiRes.json();
        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('Gemini 응답에서 JSON을 추출할 수 없습니다.');
        return JSON.parse(text);
      }

      const errBody = await geminiRes.text();
      lastErr = `${model} HTTP ${geminiRes.status}: ${errBody.slice(0, 200)}`;
      console.warn(`[GV-Sync] ${model} 시도 ${attempt}/2 실패 (HTTP ${geminiRes.status})`);

      if (geminiRes.status === 503 || geminiRes.status === 429) {
        await new Promise((r) => setTimeout(r, attempt * 2500));
        continue;
      }
      break;
    }
  }

  throw new Error(`Gemini API 오류: ${lastErr}`);
}

async function main() {
  console.log(`[GV-Sync] 크롤링 시작: ${BOARD_URL}`);
  const latestImageUrl = await crawlWeeklyImageUrl();
  if (!latestImageUrl) {
    console.log('[GV-Sync] 식단표 이미지를 찾지 못했습니다.');
    return;
  }
  console.log(`[GV-Sync] 발견된 식단표 이미지: ${latestImageUrl}`);

  const { data: state } = await supabase
    .from('cafeteria_sync_state')
    .select('last_image_url, period')
    .eq('restaurant', '글빌 식당')
    .maybeSingle();

  if (!force && state?.last_image_url === latestImageUrl) {
    console.log(`[GV-Sync] 변경 없음 (이미 최신 식단표 반영됨: ${state.period}). 종료합니다.`);
    return;
  }

  console.log('[GV-Sync] 새 식단표 이미지 감지! 메모리에서 Gemini Vision 파싱 중...');
  const parsed = await parseMenuImage(latestImageUrl);

  const rows = [];
  let sortOrder = 1;
  (parsed.days || []).forEach((day, idx) => {
    const dayNum = idx + 1;
    const slots = [
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

  if (rows.length === 0) throw new Error('파싱된 메뉴가 0건입니다.');

  const { error: upsertErr } = await supabase
    .from('cafeteria_menus')
    .upsert(rows, { onConflict: 'id' });
  if (upsertErr) throw new Error(`cafeteria_menus upsert 실패: ${upsertErr.message}`);

  const { error: stateErr } = await supabase.from('cafeteria_sync_state').upsert(
    {
      restaurant: '글빌 식당',
      source_url: BOARD_URL,
      last_image_url: latestImageUrl,
      period: parsed.period || `${parsed.days[0].date} ~ ${parsed.days[parsed.days.length - 1].date}`,
      last_synced_at: new Date().toISOString(),
    },
    { onConflict: 'restaurant' }
  );
  if (stateErr) throw new Error(`cafeteria_sync_state upsert 실패: ${stateErr.message}`);

  console.log(`[GV-Sync] 완료! ${parsed.period} (${rows.length}건) Supabase DB 업데이트 성공.`);
}

main().catch((err) => {
  console.error('[GV-Sync] 실패:', err);
  process.exit(1);
});
