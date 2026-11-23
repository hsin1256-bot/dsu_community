/**
 * LLM 공지사항 구조화 추출 및 제목/본문 요약 모듈
 * 
 * Method A 표준:
 *  - 모델: gemini-3.1-flash-lite (폴백: gemini-flash-lite-latest)
 *  - 기능: 모바일용 제목 정제(cleanTitle) + 핵심 3~4줄 불릿 요약(contentSummary) 1회 통합 처리
 *  - 서버 사이드 전용 (GEMINI_API_KEY)
 */

const PRIMARY_MODEL = 'gemini-3.1-flash-lite';
const FALLBACK_MODEL = 'gemini-flash-lite-latest';

export interface AIAnalysisResult {
  /** done: 정상 요약 / fallback: 본문이 없어 요약 불필요(포스터 등) / failed: API 실패 → 다음 동기화 때 재시도 */
  status: 'done' | 'fallback' | 'failed' | 'pending';
  cleanTitle: string;
  contentSummary: string;
  summary: string[];
  deadlineDate: string | null;
  keywords: string[];
}

// 규칙 기반 스마트 제목 정제 (폴백용)
export function smartCleanTitle(rawTitle: string): string {
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

  title = title.replace(/\[(전체|학사|행사|공지|일반|모집|장학|취업)\]/g, ' ');
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

/**
 * Method A 통합 AI 분석기: 1회 API 호출로 제목 정제 및 불릿 요약 생성
 */
export async function analyzeNoticeWithAI(
  rawTitle: string,
  rawText: string,
  hasImages = false,
  modelName = PRIMARY_MODEL,
  retryCount = 0
): Promise<AIAnalysisResult> {
  const cleanContent = (rawText || '').trim().slice(0, 3000);

  // 본문이 거의 없고 포스터 이미지만 있는 경우
  if (!cleanContent || cleanContent.length < 30) {
    const fallbackTitle = smartCleanTitle(rawTitle);
    const fallbackContent = hasImages
      ? '📌 본 공지는 포스터 이미지로 안내되는 공지입니다.\n아래 첨부된 포스터 내용 및 하단 학교 공식 홈페이지 원문 링크에서 세부 내용을 확인해 주세요.'
      : '상세 내용은 하단 학교 공식 홈페이지 링크를 확인해 주세요.';
    return {
      status: 'fallback',
      cleanTitle: fallbackTitle,
      contentSummary: fallbackContent,
      summary: [fallbackTitle],
      deadlineDate: null,
      keywords: [],
    };
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
  if (GEMINI_API_KEY) {
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
- 행사/공지 대상, 주요 일정(일시/신청 기간/장소), 핵심 혜택 및 내용(기프티콘, 참가비 무료, 마일리지, 수료증 등), 신청 방법/링크 또는 문의처를 중심으로 요약하세요.
- ⚠️ 웹 링크(URL)가 있는 경우 절대 [URL](URL) 처럼 같은 주소를 중복 표기하지 말고, '• **신청 링크**: https://...' 처럼 하나의 깔끔한 주소로만 1회 표기하세요.
- 마크다운 볼드(**)와 불릿(•)을 사용하여 가독성을 높이세요.
- 친절하고 명확한 문체(~합니다, ~바랍니다)를 사용하세요.

[요청 3: deadlineDate]
- 명시된 최종 신청 마감일이 있는 경우 YYYY-MM-DD 형식으로 작성하고, 없으면 null로 표기하세요.

[요청 4: keywords]
- 공지의 핵심 키워드 3~5개를 문자열 배열로 작성하세요.

반드시 다른 설명 없이 아래 JSON 규격으로만 응답하세요:
{
  "cleanTitle": "정제된 제목",
  "contentSummary": "• 대상: ...\\n• 일시 및 장소: ...\\n• 주요 내용 및 혜택: ...\\n• 신청 방법: ...",
  "deadlineDate": "YYYY-MM-DD 또는 null",
  "keywords": ["키워드1", "키워드2"]
}

원본 제목: "${rawTitle}"
원본 본문:
"""
${cleanContent}
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
          const parsed = JSON.parse(rawJson);
          let cleanTitle = (parsed.cleanTitle || smartCleanTitle(rawTitle)).replace(/^['"`\s]+|['"`\s]+$/g, '').trim();
          let contentSummary = parsed.contentSummary || '';

          // 중복 URL 정제
          contentSummary = contentSummary.replace(/\[(https?:\/\/[^\s\]]+)\]\(\1\)/g, '$1');
          contentSummary = contentSummary.replace(/\[(https?:\/\/[^\s\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, '$2');

          const summaryLines = contentSummary
            .split('\n')
            .map((l: string) => l.replace(/^[\*•\-]\s*/, '').trim())
            .filter(Boolean);

          return {
            status: 'done',
            cleanTitle,
            contentSummary,
            summary: summaryLines.length > 0 ? summaryLines.slice(0, 4) : [cleanTitle],
            deadlineDate: typeof parsed.deadlineDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.deadlineDate) ? parsed.deadlineDate : null,
            keywords: Array.isArray(parsed.keywords) ? parsed.keywords.filter((k: unknown) => typeof k === 'string').slice(0, 5) : [],
          };
        }
      } else if (res.status === 429 && retryCount < 2) {
        console.warn(`[429 Rate Limit] Model ${modelName}. Retrying with fallback model...`);
        return analyzeNoticeWithAI(rawTitle, rawText, hasImages, FALLBACK_MODEL, retryCount + 1);
      } else if (res.status === 503 && retryCount < 2) {
        console.warn(`[503 Busy] Model ${modelName}. Retrying with fallback model...`);
        return analyzeNoticeWithAI(rawTitle, rawText, hasImages, FALLBACK_MODEL, retryCount + 1);
      }
    } catch (err: any) {
      console.warn('[analyzeNoticeWithAI error]', err.message);
    }
  }

  // 폴백: 정규식 및 슬라이스
  const fallbackTitle = smartCleanTitle(rawTitle);
  // 키가 없으면 '실패'가 아니라 '대기' → 키를 넣은 뒤 동기화 때 요약 (키 없이 매번 재시도하지 않음)
  const fallbackStatus: AIAnalysisResult['status'] = GEMINI_API_KEY ? 'failed' : 'pending';
  const fallbackText = cleanContent.slice(0, 250).replace(/\s+/g, ' ').trim() + '...\n\n(자세한 내용은 하단 학교 홈페이지 원문을 확인해 주세요.)';
  return {
    status: fallbackStatus,
    cleanTitle: fallbackTitle,
    contentSummary: fallbackText,
    summary: [fallbackTitle],
    deadlineDate: null,
    keywords: [],
  };
}

// 하위 호환성을 위한 extractNoticeWithLLM 유지 (동일 로직 호출)
export async function extractNoticeWithLLM(
  title: string,
  content: string
): Promise<{ summary: string[]; deadlineDate: string | null; keywords: string[]; targetAudience: string }> {
  const result = await analyzeNoticeWithAI(title, content);
  return {
    summary: result.summary,
    deadlineDate: result.deadlineDate,
    keywords: result.keywords,
    targetAudience: '동서대학교 재학생',
  };
}
