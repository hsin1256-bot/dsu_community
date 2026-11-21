/**
 * LLM 공지사항 구조화 추출 모듈
 * Google Gemini API를 활용하여 3줄 요약, 마감일(D-Day), 핵심 키워드 태그를 추출합니다.
 * API 키가 없거나 호출 실패 시에도 서비스가 중단되지 않도록 정규식 기반 스마트 폴백을 제공합니다.
 */

export interface NoticeExtractionResult {
  summary: string[];          // 핵심 3줄 요약
  deadlineDate: string | null;// 마감일 (YYYY-MM-DD) 또는 null
  keywords: string[];         // 키워드 태그 목록 (키워드 알림과 연동)
  targetAudience: string;     // 대상자
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

export async function extractNoticeWithLLM(
  title: string,
  content: string
): Promise<NoticeExtractionResult> {
  const cleanContent = (content || '').trim().slice(0, 3500);

  // Gemini API 키가 있는 경우 gemini-1.5-pro 고정 호출
  if (GEMINI_API_KEY && cleanContent.length > 30) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`;

      const prompt = `
당신은 동서대학교 학생들을 위한 공지사항 분석 AI입니다.
아래 공지사항 제목과 본문을 분석하여 대학생에게 꼭 필요한 핵심 정보를 정확히 추출하세요.
반드시 아래 JSON 형식으로만 응답하고, 마크다운 코드블록(\`\`\`json 등) 없이 순수 JSON 문자열만 출력하세요.

{
  "summary": [
    "핵심 요약 문장 1 (공지 목적 및 주요 내용)",
    "핵심 요약 문장 2 (신청/참여 기간, 자격 요건, 혜택 등)",
    "핵심 요약 문장 3 (신청 방법, 필수 제출 서류, 주의사항)"
  ],
  "deadlineDate": "YYYY-MM-DD 또는 마감일이 명시되지 않은 경우 null",
  "keywords": ["핵심키워드1", "핵심키워드2", "핵심키워드3"],
  "targetAudience": "대상 학생 요약 (예: 재학생 전원, 3~4학년 등)"
}

[공지사항 제목]
${title}

[공지사항 본문]
${cleanContent}
      `.trim();

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const rawJsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawJsonText) {
          const parsed = JSON.parse(rawJsonText);
          return {
            summary: Array.isArray(parsed.summary) && parsed.summary.length > 0
              ? parsed.summary.slice(0, 3)
              : [title],
            deadlineDate: typeof parsed.deadlineDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.deadlineDate)
              ? parsed.deadlineDate
              : null,
            keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 6) : [],
            targetAudience: parsed.targetAudience || '전체 재학생',
          };
        }
      }
    } catch (err) {
      console.warn('[LLM Extractor] gemini-1.5-pro failed, using smart fallback', err);
    }
  }

  // 폴백: 키워드 및 날짜 정규식 기반 자체 추출
  return smartFallbackExtraction(title, cleanContent);
}

/**
 * 정규식 및 키워드 사전을 활용한 스마트 폴백 추출기
 */
function smartFallbackExtraction(title: string, content: string): NoticeExtractionResult {
  const text = `${title}\n${content}`;

  // 1. 마감일 패턴 탐색 (예: ~ 10. 15, ~ 2026.10.15, ~ 10/15 등)
  let deadlineDate: string | null = null;
  const deadlineRegex = /(?:마감|신청\s*기?간?|접수\s*기?간?|기\s*한)[\s\S]{0,40}?(\d{4}[.-/]\s*\d{1,2}[.-/]\s*\d{1,2}|\d{1,2}[.-/]\s*\d{1,2})/i;
  const match = text.match(deadlineRegex);

  if (match && match[1]) {
    const raw = match[1].replace(/\s+/g, '');
    const parts = raw.split(/[.-/]/).filter(Boolean);
    const currentYear = new Date().getFullYear();
    if (parts.length === 3) {
      const y = parts[0].length === 2 ? `20${parts[0]}` : parts[0];
      deadlineDate = `${y}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    } else if (parts.length === 2) {
      deadlineDate = `${currentYear}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    }
  }

  // 2. 키워드 태그 자동 추출
  const KEYWORD_CANDIDATES = [
    '장학금', '수강신청', '등록금', '중간고사', '기말고사', '성적', '계절학기',
    '졸업', '휴학', '복학', '기숙사', '학생생활관', '대동제', '축제', '취업',
    '채용', '인턴', '공모전', '봉사', '토익', '어학', '현장실습', '창업', '증명서'
  ];
  const foundKeywords = KEYWORD_CANDIDATES.filter(kw => text.includes(kw));

  // 3. 3줄 요약 문장 생성
  const sentences = content
    .split(/[\n.]/)
    .map(s => s.trim())
    .filter(s => s.length > 15 && !s.includes('http') && !s.includes('문의:'));

  const summary: string[] = [];
  summary.push(`• ${title}`);
  if (sentences.length > 0) {
    summary.push(`• ${sentences[0]}`);
  }
  if (sentences.length > 1) {
    summary.push(`• ${sentences[1]}`);
  } else if (deadlineDate) {
    summary.push(`• 주요 마감 일정: ${deadlineDate}까지`);
  }

  return {
    summary,
    deadlineDate,
    keywords: foundKeywords.slice(0, 5),
    targetAudience: '동서대학교 재학생',
  };
}
