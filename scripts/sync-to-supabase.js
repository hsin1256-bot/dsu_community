/**
 * 동서대학교 공지사항(학사, 행사 등) 크롤링 -> AI 제목 및 본문 요약 -> Supabase DB 저장 일체형 파이프라인
 * 
 * 사용법:
 *   node scripts/sync-to-supabase.js --category 행사 --count 15
 *   node scripts/sync-to-supabase.js --category 학사 --count 15
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');

// 1. .env.local 환경 변수 로드
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const env = {};
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        env[match[1]] = (match[2] || '').trim();
      }
    }
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const GEMINI_API_KEY = env.GEMINI_API_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DSU_BASE_URL = 'https://www.dongseo.ac.kr';
const PRIMARY_MODEL = 'gemini-3.1-flash-lite';
const FALLBACK_MODEL = 'gemini-flash-lite-latest';

const PCODE_MAP = {
  '행사': 'MN2000191',
  '학사': 'MN2000194',
  '일반': 'MN2000192',
  '장학': 'MN2000195',
  '취업': 'MN2000197',
};

// 커맨드라인 파라미터 파싱
const args = process.argv.slice(2);
let targetCategory = '행사';
let targetCount = 15;
let minNum = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--category' || args[i] === '-c') {
    targetCategory = args[i + 1] || targetCategory;
    i++;
  } else if (args[i] === '--count' || args[i] === '-n') {
    targetCount = parseInt(args[i + 1], 10) || targetCount;
    i++;
  } else if (args[i] === '--min-num' || args[i] === '-m') {
    minNum = parseInt(args[i + 1], 10) || null;
    i++;
  }
}

const pCode = PCODE_MAP[targetCategory] || 'MN2000191';
const TARGET_URL = `https://www.dongseo.ac.kr/kr/?pCode=${pCode}`;

// 규칙 기반 스마트 제목 정제 (폴백용)
function smartCleanTitle(rawTitle) {
  let title = rawTitle;

  // 장식 기호 및 따옴표 제거
  title = title.replace(/[★☆]/g, ' ');
  title = title.replace(/^['"<]+|['">]+$/g, '');

  let semester = '';
  const semMatch = title.match(/(?:20\d{2}[-.\s]*)?([12]학기|계절학기)/);
  if (semMatch) semester = semMatch[1];

  // 타대학 / 학교명 보존 (신라대, 한국해양대, 동의대, 부산대, 동아대 등)
  const univMatch = title.match(/타대학\s*\(([가-힣]+대학교|[가-힣]+대)\)/) || title.match(/\(([가-힣]+대학교|[가-힣]+대)\)/);
  const univName = univMatch ? univMatch[1] : '';

  title = title.replace(/\[(전체|학사|행사|공지|일반|장학|취업)\]/g, ' ');
  title = title.replace(/\(~.*?\)/g, ' ');
  title = title.replace(/\[\d+\/\d+.*?\]/g, ' ');
  title = title.replace(/타대학/g, ' ');
  title = title.replace(/의\s*건$/g, '').replace(/에\s*관한\s*공고$/g, '').replace(/공고$/g, '안내');
  title = title.replace(/\s+/g, ' ').trim();

  // 학교명이 지워졌다면 제목 앞쪽에 자연스럽게 복원
  if (univName && !title.includes(univName)) {
    if (/(20\d{2}학년도)/.test(title)) {
      title = title.replace(/(20\d{2}학년도)\s*/, `$1 ${univName} `);
    } else {
      title = `${univName} ${title}`;
    }
  }

  if (semester && !title.includes(semester)) {
    title = `${semester} ${title}`;
  }
  return title.replace(/^['"<]+|['">]+$/g, '').replace(/\s+/g, ' ').trim();
}

// 딜레이 헬퍼 (API Rate Limit 방지)
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 통합 AI 요약 함수 (제목 정제 + 본문 3~4줄 불릿 요약을 1회 API 호출로 처리)
async function analyzeNoticeWithAI(rawTitle, rawText, hasImages, modelName = PRIMARY_MODEL, retryCount = 0) {
  // 본문이 거의 없고 포스터 이미지만 있는 경우
  if (!rawText || rawText.length < 30) {
    const fallbackTitle = smartCleanTitle(rawTitle);
    const fallbackContent = hasImages
      ? '📌 본 행사는 포스터 이미지로 안내되는 공지입니다.\n아래 첨부된 포스터 내용 및 하단 학교 공식 홈페이지 원문 링크에서 세부 내용을 확인해 주세요.'
      : '상세 내용은 하단 학교 공식 홈페이지 링크를 확인해 주세요.';
    return { cleanTitle: fallbackTitle, contentSummary: fallbackContent };
  }

  const prompt = `
당신은 대학교 캠퍼스 앱의 공지/행사 편집 전문 에디터입니다.
아래 원본 공지 정보를 분석하여 학생이 모바일 앱에서 한눈에 핵심을 파악할 수 있도록 JSON 형식으로 응답해 주세요.

[요청 1: cleanTitle]
- 모바일 화면용 정제 제목.
- 불필요한 장식 기호(★, ★★, 📌 등), 문장 앞뒤의 감싸는 특수문자(' " < >), 대괄호([학사], [행사], [전체] 등)는 정리하세요.
- ⚠️ 특정 대학교나 기관/주관 부서명(예: 신라대, 동아대, 평생교육원, 청년도약 인재양성 부트캠프사업단, 학생성공센터, 학생생활상담센터, 대학혁신지원사업단, 사회봉사센터 등)이 포함된 경우 학생들이 출처를 알 수 있도록 기관/학교 이름을 반드시 제목에 포함하세요!
- 주요 인물(예: 산악인 엄홍길 대장)이나 핵심 행사명(예: DSU ANCHOR FAIR, 학술엑스포, KUSF 공모전 등)은 반드시 포함하여 자연스러운 안내 제목으로 만드세요.
- 날짜 태그(~11/30, 11/14 등)는 본문에서 다루므로 제목에서는 제거하세요.
- 말끝의 군더더기('~의 건', '~에 관한 공고')를 제거하세요.

[요청 2: contentSummary]
- 본문의 핵심 내용을 3~4개 내외의 깔끔한 불릿(•) 포인트로 요약하세요.
- 행사 대상, 주요 일정(일시/신청 기간/장소), 핵심 혜택 및 내용(기프티콘, 참가비 무료, 마일리지, 수료증 등), 신청 방법/링크 또는 문의처를 중심으로 요약하세요.
- ⚠️ 웹 링크(URL)가 있는 경우 절대 [URL](URL) 처럼 같은 주소를 중복 표기하지 말고, '• **신청 링크**: https://...' 처럼 하나의 깔끔한 주소로만 1회 표기하세요.
- 마크다운 볼드(**)와 불릿(•)을 사용하여 가독성을 높이세요.
- 친절하고 명확한 문체(~합니다, ~바랍니다)를 사용하세요.

반드시 다른 설명 없이 아래 JSON 규격으로만 응답하세요:
{
  "cleanTitle": "정제된 제목",
  "contentSummary": "• 대상: ...\\n• 일시 및 장소: ...\\n• 주요 내용 및 혜택: ...\\n• 신청 방법: ..."
}

원본 제목: "${rawTitle}"
원본 본문:
"""
${rawText.slice(0, 3000)}
"""
  `.trim();

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (rawJson) {
        try {
          const parsed = JSON.parse(rawJson);
          let cleanTitle = (parsed.cleanTitle || smartCleanTitle(rawTitle)).replace(/^['"`\s]+|['"`\s]+$/g, '').trim();
          let contentSummary = parsed.contentSummary || '';

          // 중복 URL 정제
          contentSummary = contentSummary.replace(/\[(https?:\/\/[^\s\]]+)\]\(\1\)/g, '$1');
          contentSummary = contentSummary.replace(/\[(https?:\/\/[^\s\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, '$2');

          return { cleanTitle, contentSummary };
        } catch (jsonErr) {
          console.warn('[JSON parse warning]', jsonErr.message);
        }
      }
    } else if (res.status === 429 && retryCount < 2) {
      console.warn(`[429 Rate Limit] Model ${modelName}. Waiting 3s before retry...`);
      await delay(3000);
      return analyzeNoticeWithAI(rawTitle, rawText, hasImages, FALLBACK_MODEL, retryCount + 1);
    } else if (res.status === 503 && retryCount < 2) {
      console.warn(`[503 Busy] Model ${modelName}. Trying fallback model...`);
      await delay(1500);
      return analyzeNoticeWithAI(rawTitle, rawText, hasImages, FALLBACK_MODEL, retryCount + 1);
    } else {
      console.warn(`[Gemini API HTTP Error] Status ${res.status}`);
    }
  } catch (err) {
    console.error('[Gemini Request Exception]', err.message);
  }

  // 폴백
  return {
    cleanTitle: smartCleanTitle(rawTitle),
    contentSummary: rawText.slice(0, 250).replace(/\s+/g, ' ').trim() + '...\n\n(자세한 내용은 하단 학교 홈페이지 원문을 확인해 주세요.)',
  };
}

// 날짜 정규화: '15:15' 같은 당일 시간 표기는 오늘 날짜(YYYY-MM-DD)로 변환
function normalizeDate(rawDate) {
  const trimmed = (rawDate || '').trim();
  if (/^\d{1,2}:\d{1,2}$/.test(trimmed)) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return trimmed;
}

// 상세 본문 크롤링
async function fetchNoticeDetail(idx, pCodeParam, href) {
  let detailUrl = `${DSU_BASE_URL}/kr/?pCode=${pCodeParam}&mode=view&idx=${idx}`;
  if (href) {
    detailUrl = href.startsWith('http') ? href : `${DSU_BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`;
  }

  try {
    const res = await fetch(detailUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });
    if (!res.ok) return null;

    const html = await res.text();
    const $ = cheerio.load(html);

    // SNS 공유 및 불필요 스크립트 제거
    $('script, style, iframe, object, embed, noscript, .pageSNSShare, [class*="sns"], [id*="sns"]').remove();

    const $content = $('#boardContents').length 
      ? $('#boardContents') 
      : $('.board-view-contents, .board-view-cont, .view_con, .view_content, .board_view').first();

    // 이미지 절대경로 및 반응형 스타일 변환
    $content.find('img').each((_, el) => {
      let src = $(el).attr('src') || $(el).attr('data-src') || '';
      if (src && !src.startsWith('http')) {
        $(el).attr('src', `${DSU_BASE_URL}${src.startsWith('/') ? '' : '/'}${src}`);
      }
      $(el).removeAttr('width');
      $(el).removeAttr('height');
      $(el).removeAttr('org_width');
      $(el).removeAttr('org_height');
      $(el).removeAttr('zoomview');
      $(el).addClass('max-w-full h-auto rounded-xl my-3 mx-auto block shadow-sm');
    });

    // 링크 절대경로 변환
    $content.find('a').each((_, el) => {
      let hrefAttr = $(el).attr('href') || '';
      if (hrefAttr && !hrefAttr.startsWith('http') && !hrefAttr.startsWith('mailto:') && !hrefAttr.startsWith('tel:') && !hrefAttr.startsWith('#')) {
        $(el).attr('href', `${DSU_BASE_URL}${hrefAttr.startsWith('/') ? '' : '/'}${hrefAttr}`);
      }
      $(el).attr('target', '_blank');
      $(el).attr('rel', 'noopener noreferrer');
    });

    // 빈 div 정리
    $content.find('div.cs-editor-outp').each((_, el) => {
      if (!$(el).text().trim() && !$(el).find('img').length && !$(el).find('table').length) {
        $(el).remove();
      }
    });

    const hasImages = $content.find('img').length > 0;
    const contentText = $content.text().replace(/\s+/g, ' ').trim();

    return {
      contentHtml: $content.html()?.trim() || '',
      contentText: contentText || '',
      hasImages,
    };
  } catch (err) {
    console.error(`[Detail fetch error for ${idx}]`, err);
    return null;
  }
}

async function runPipeline() {
  console.log(`\n======================================================`);
  console.log(`[🚀 동서대 "${targetCategory}" 공지 ➔ AI 요약 ➔ Supabase 저장 파이프라인]`);
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log(`카테고리: ${targetCategory} (pCode: ${pCode})`);
  console.log(`크롤링 타겟: ${TARGET_URL}`);
  console.log(`AI 모델: ${PRIMARY_MODEL}`);
  console.log(`목표 수집 개수: ${targetCount}개`);
  console.log(`======================================================\n`);

  // 1. 공지사항 목록 크롤링
  console.log(`1️⃣ 동서대학교 ${targetCategory} 공지사항 목록 가져오는 중...`);
  const res = await fetch(TARGET_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
  });

  if (!res.ok) {
    console.error(`접속 실패: HTTP ${res.status}`);
    return;
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const rows = $('table.bbs_list tbody tr, table.board_list tbody tr, table.list_table tbody tr, table tbody tr');
  console.log(`총 ${rows.length}개 행 발견! 상단 고정(공지) 글을 건너뛰고 최신 일반 공지만 ${targetCount}건 수집합니다.\n`);

  // 기존에 DB에 저장된 공지 목록 조회
  const { data: existingRows } = await supabase.from('notices').select('id, title, category, content_text');
  const existingMap = new Map((existingRows || []).map(r => [r.id, r]));

  const noticesToInsert = [];
  let collectedCount = 0;

  for (let i = 0; i < rows.length; i++) {
    if (collectedCount >= targetCount) {
      console.log(`\n🛑 목표 수집 개수(${targetCount}개)에 도달하여 수집을 종료합니다.`);
      break;
    }

    const $row = rows.eq(i);

    // 첫 번째 번호 칸 검사
    const firstTd = $row.find('td').first();
    const numText = firstTd.text().replace(/\s+/g, '').trim();

    // '공지' 뱃지나 번호가 비어있거나 숫자가 아닌 행은 스킵
    const isPinned = numText.includes('공지') || 
                     $row.hasClass('notice') || 
                     $row.find('.icon_notice, .notice_icon, .noti, img[alt*="공지"]').length > 0;

    if (isPinned || !/^\d+$/.test(numText)) {
      continue; // 상단 고정 중요 공지는 건너뜁니다!
    }

    const postNum = parseInt(numText, 10);
    if (minNum !== null && !isNaN(postNum) && postNum < minNum) {
      console.log(`\n🛑 [최소 번호 도달] ${postNum}번 공지 발견. ${minNum}번 미만이므로 종료합니다.`);
      break;
    }

    const titleLink = $row.find('td.title a, td.subject a, td.tit a, a.tit, a[href*="idx="]').first();
    const rawTitle = titleLink.text().replace(/\s+/g, ' ').trim();
    const href = titleLink.attr('href') || '';
    if (!rawTitle) continue;

    const author = $row.find('td.name, td.writer, td.author, .writer').text().trim() || '동서대학교';
    const rawDate = $row.find('td.date, td.reg_date, .date').text().trim();
    const formattedDate = normalizeDate(rawDate);
    const viewsStr = $row.find('td.hit, td.view, .hit').text().trim();
    const views = parseInt(viewsStr.replace(/[^\d]/g, ''), 10) || 0;

    const urlParams = new URLSearchParams(href.replace(/^.*\?/, ''));
    const idx = urlParams.get('idx') || `dsu-${numText}`;
    const fullUrl = href.startsWith('http') ? href : `${DSU_BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`;

    collectedCount++;

    // 이미 DB에 같은 카테고리로 요약까지 완료된 공지인지 확인
    const alreadySaved = existingMap.get(idx);
    if (alreadySaved && alreadySaved.category === targetCategory && alreadySaved.content_text && alreadySaved.content_text.length > 20) {
      console.log(`[기저장 스킵] [${collectedCount}/${targetCount}] [번호: ${numText}] ID: ${idx} - 이미 DB에 저장되어 있어 스킵합니다.`);
      continue;
    }

    console.log(`------------------------------------------------------`);
    console.log(`[✨ 신규 ${targetCategory} 공지 (${collectedCount}/${targetCount}) | 번호: ${numText}] 글 idx: ${idx}`);
    console.log(`   📌 원본 제목: "${rawTitle}"`);
    console.log(`   📅 등록일: ${formattedDate} (원문: ${rawDate}) | 작성자: ${author}`);

    // 상세 본문 크롤링
    console.log(`   📄 본문 내용 크롤링 중...`);
    const detail = await fetchNoticeDetail(idx, pCode, href);

    // AI 통합 요약 (제목 정제 + 본문 불릿 요약)
    console.log(`   🤖 AI 통합 요약 생성 중...`);
    const { cleanTitle, contentSummary } = await analyzeNoticeWithAI(
      rawTitle,
      detail?.contentText || '',
      detail?.hasImages || false
    );
    console.log(`   ✨ AI 정제 제목: "${cleanTitle}"`);
    console.log(`   💡 요약된 본문:\n${contentSummary.split('\n').map(l => '      ' + l).join('\n')}`);

    noticesToInsert.push({
      id: idx,
      title: cleanTitle,
      raw_title: rawTitle,
      category: targetCategory,
      author,
      date: formattedDate,
      views,
      url: fullUrl,
      content_html: detail?.contentHtml || '',
      content_text: contentSummary,
    });

    await delay(1500); // API Rate limit 방지
  }

  if (noticesToInsert.length === 0) {
    console.log('\n✅ 새로 추가할 신규 공지가 없습니다. 모든 공지가 이미 DB에 저장되어 있습니다!');
    console.log(`======================================================\n`);
    return;
  }

  // 5. Supabase DB에 Upsert 실행
  console.log(`\n------------------------------------------------------`);
  console.log(`2️⃣ Supabase notices 테이블에 ${noticesToInsert.length}건 저장 중...`);

  const { data, error } = await supabase
    .from('notices')
    .upsert(noticesToInsert, { onConflict: 'id' })
    .select('id, title, category, content_text');

  if (error) {
    console.error('❌ Supabase 저장 실패:', error.message);
  } else {
    console.log(`\n🎉 [성공!] Supabase notices 테이블에 ${targetCategory} 공지 ${data.length}건이 완벽하게 저장되었습니다!`);
    data.forEach((row, i) => {
      console.log(`   [${i + 1}] ID: ${row.id} [${row.category}] | 제목: "${row.title}"`);
    });
  }

  console.log(`======================================================\n`);
}

runPipeline();
