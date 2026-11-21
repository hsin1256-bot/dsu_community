import * as cheerio from 'cheerio';
import { Notice, NoticeCategory, CafeteriaMenu, AcademicSchedule, RestaurantType } from '@/types';

// 동서대학교 공식 도메인 및 게시판 pCode 매핑
const DSU_BASE_URL = 'https://www.dongseo.ac.kr';
export const PCODE_MAP: Record<NoticeCategory, string> = {
  '전체': 'MN2000194',
  '학사': 'MN2000194',
  '일반': 'MN2000192',
  '장학': 'MN2000195',
  '취업': 'MN2000197',
  '행사': 'MN2000191',
};

// 현실적인 동서대 기본 목업 데이터 (오프라인 / 스크래핑 실패 시 즉각 폴백)
export const MOCK_NOTICES: Notice[] = [
  {
    id: 'dsu-101',
    title: '[학사] 2026학년도 2학기 수강신청 변경 및 정정 기간 안내',
    category: '학사',
    author: '교무처 학사지원팀',
    date: '2026-09-25',
    views: 1842,
    isPinned: true,
    url: 'https://www.dongseo.ac.kr/kr/index.php?pCode=MN2000193&mode=view&idx=101',
    contentText: `2026학년도 2학기 수강신청 변경 및 최종 정정 기간을 다음과 같이 안내하오니 학생 여러분께서는 기간 내에 필히 확인하시기 바랍니다.\n\n1. 정정 기간: 2026. 09. 28(월) 10:00 ~ 10. 02(금) 17:00까지\n2. 대상: 재학생 및 복학생 전원\n3. 신청 방법: 동서대학교 종합정보시스템(포털) 로그인 > 학생정보 > 수강정정\n4. 유의사항:\n - 최소 이수학점(12학점 이상) 미달 시 장학금 수혜 대상에서 제외될 수 있습니다.\n - 폐강 강좌 수강생은 반드시 타 강좌로 대체 신청바랍니다.`,
    attachments: [
      { name: '2026-2학기 수강신청 정정 매뉴얼.pdf', url: 'https://www.dongseo.ac.kr/files/manual_2026_2.pdf', size: '1.4MB' },
      { name: '개설강좌 변경사항 목록.xlsx', url: 'https://www.dongseo.ac.kr/files/courses_change.xlsx', size: '240KB' }
    ]
  },
  {
    id: 'dsu-102',
    title: '[장학] 2026년 2학기 동서희망장학금 및 성적우수장학금 지급 일정 안내',
    category: '장학',
    author: '학생취업지원처',
    date: '2026-09-24',
    views: 2410,
    isPinned: true,
    url: 'https://www.dongseo.ac.kr/kr/index.php?pCode=MN2000194&mode=view&idx=102',
    contentText: `2026학년도 2학기 동서희망장학금 및 교내 성적우수장학금 지급 관련 일정을 안내해 드립니다.\n\n1. 지급 대상: 장학생 선발 심사를 통과한 본교 정규학기 등록 재학생\n2. 지급 방법: 학생 종합정보시스템에 등록된 본인 명의 계좌 입금 또는 학자금 대출 상환\n3. 지급 예정일: 2026. 10. 15(목) 오후 순차 지급 예정\n4. 문의처: 학생취업지원처 장학지원팀 (051-320-2043~4)`,
    attachments: [
      { name: '2026-2 장학금 지급 규정 및 선발 기준안.hwp', url: 'https://www.dongseo.ac.kr/files/scholarship_rule.hwp', size: '820KB' }
    ]
  },
  {
    id: 'dsu-103',
    title: '[일반] 2026 DSU 가을 대동제 축제 및 동아리 버스킹 공연 일정 안내',
    category: '일반',
    author: '총학생회',
    date: '2026-09-23',
    views: 3120,
    isPinned: false,
    url: 'https://www.dongseo.ac.kr/kr/index.php?pCode=MN2000192&mode=view&idx=103',
    contentText: `학우 여러분 안녕하십니까! 2026년 동서대학교 가을 대동제가 본교 스튜던트 플라자 및 민석스포츠센터 야외 광장에서 개최됩니다.\n\n일시: 2026. 10. 08(목) ~ 10. 09(금) 양일간\n주요 프로그램:\n - 초대가수 축하공연 (라인업 추후 인스타그램 및 공지 발표)\n - 단과대별 야시장 및 푸드트럭 운영\n - 동아리 버스킹 및 DSU e스포츠 결승전\n\n안전하고 즐거운 축제가 될 수 있도록 많은 관심과 참여 부탁드립니다.`,
    attachments: [
      { name: '대동제 부스배치도 및 안전수칙.png', url: 'https://www.dongseo.ac.kr/files/festival_map.png', size: '3.1MB' }
    ]
  },
  {
    id: 'dsu-104',
    title: '[취업] 2026 하반기 주요 IT/소프트웨어 및 대기업 채용박람회 참가 안내',
    category: '취업',
    author: '대학일자리플러스센터',
    date: '2026-09-21',
    views: 940,
    isPinned: false,
    url: 'https://www.dongseo.ac.kr/kr/index.php?pCode=MN2000195&mode=view&idx=104',
    contentText: `대학일자리플러스센터에서 동서대 학생들을 위한 하반기 공채 대비 취업박람회 및 1:1 현직자 멘토링 세션을 운영합니다.\n\n- 일시: 2026. 10. 14(수) 13:00 ~ 18:00\n- 장소: 뉴밀레니엄관 2층 글로벌룸\n- 사전 등록 혜택: 이력서 무료 사진 촬영권 및 현직자 모의면접 참가 기회 제공`,
    attachments: [
      { name: '참가기업 명단 및 사전신청서.hwp', url: 'https://www.dongseo.ac.kr/files/job_fair_list.hwp', size: '512KB' }
    ]
  },
  {
    id: 'dsu-105',
    title: '[행사] 제14회 동서 미디어 콘텐츠 공모전 출품작 접수 (상금 총 1,000만원)',
    category: '행사',
    author: '미디어커뮤니케이션학부',
    date: '2026-09-20',
    views: 1250,
    isPinned: false,
    url: 'https://www.dongseo.ac.kr/kr/index.php?pCode=MN2000196&mode=view&idx=105',
    contentText: `동서대학교 미디어 혁신 인재 양성을 위한 2026 전국 대학생 미디어 콘텐츠 공모전을 개최합니다. 본교 재학생 여러분의 번뜩이는 아이디어와 작품을 기다립니다.`,
    attachments: []
  }
];

// 학식 목업 데이터 (학생식당, 교직원식당, 기숙사식당)
export const MOCK_CAFETERIA: CafeteriaMenu[] = [
  {
    id: 'caf-1',
    date: '2026-09-27',
    restaurant: '학생식당',
    mealType: '중식',
    cornerName: '일품코너',
    menuItems: ['수제 돈까스 & 브라운소스', '미니 우동', '양배추 샐러드', '단무지 & 깍두기', '요구르트'],
    price: '5,500원',
    calories: '890 kcal',
    rating: 4.6,
    reviewCount: 28,
  },
  {
    id: 'caf-2',
    date: '2026-09-27',
    restaurant: '학생식당',
    mealType: '중식',
    cornerName: '찌개 & 백반코너',
    menuItems: ['돼지고기 김치찌개', '계란말이 & 케첩', '어묵볶음', '잡곡밥 / 쌀밥', '총각김치'],
    price: '5,000원',
    calories: '750 kcal',
    rating: 4.3,
    reviewCount: 19,
  },
  {
    id: 'caf-3',
    date: '2026-09-27',
    restaurant: '학생식당',
    mealType: '석식',
    cornerName: '석식 정식',
    menuItems: ['매콤 제육덮밥', '유부 된장국', '감자채 볶음', '배추김치', '과일 젤리'],
    price: '5,000원',
    calories: '780 kcal',
    rating: 4.4,
    reviewCount: 14,
  },
  {
    id: 'caf-4',
    date: '2026-09-27',
    restaurant: '교직원식당',
    mealType: '중식',
    cornerName: '교직원 웰빙 뷔페',
    menuItems: ['소고기 버섯전골', '고등어 무조림', '단호박 샐러드', '시금치 나물', '현미밥 / 백미밥', '포기김치', '수정과'],
    price: '7,000원',
    calories: '820 kcal',
    rating: 4.7,
    reviewCount: 12,
  },
  {
    id: 'caf-5',
    date: '2026-09-27',
    restaurant: '기숙사식당',
    mealType: '조식',
    cornerName: '기숙사 조식',
    menuItems: ['토스트 & 딸기잼', '스크램블 에그', '소시지 구이', '양송이 스프', '시리얼 & 우유 / 주스'],
    price: '4,500원',
    calories: '620 kcal',
    rating: 4.1,
    reviewCount: 9,
  },
  {
    id: 'caf-6',
    date: '2026-09-27',
    restaurant: '기숙사식당',
    mealType: '석식',
    cornerName: '기숙사 석식',
    menuItems: ['치킨마요 덮밥', '맑은 콩나물국', '떡볶이', '깍두기', '바나나'],
    price: '5,000원',
    calories: '810 kcal',
    rating: 4.5,
    reviewCount: 22,
  }
];

// 학사일정 목업 데이터
export const MOCK_SCHEDULE: AcademicSchedule[] = [
  {
    id: 'sch-1',
    title: '2학기 수강신청 정정 기간',
    startDate: '2026-09-28',
    endDate: '2026-10-02',
    category: '수강/성적',
    isImportant: true,
    dDay: 1,
  },
  {
    id: 'sch-2',
    title: '2026 DSU 가을 대동제 축제',
    startDate: '2026-10-08',
    endDate: '2026-10-09',
    category: '행사',
    isImportant: true,
    dDay: 11,
  },
  {
    id: 'sch-3',
    title: '2학기 중간고사 시험 기간',
    startDate: '2026-10-19',
    endDate: '2026-10-23',
    category: '시험',
    isImportant: true,
    dDay: 22,
  },
  {
    id: 'sch-4',
    title: '2학기 수업일수 1/2 기준선',
    startDate: '2026-10-26',
    endDate: '2026-10-26',
    category: '수강/성적',
    isImportant: false,
    dDay: 29,
  },
  {
    id: 'sch-5',
    title: '동계 계절학기 수강신청',
    startDate: '2026-11-16',
    endDate: '2026-11-20',
    category: '수강/성적',
    isImportant: false,
    dDay: 50,
  },
  {
    id: 'sch-6',
    title: '2학기 기말고사 시험 기간',
    startDate: '2026-12-14',
    endDate: '2026-12-18',
    category: '시험',
    isImportant: true,
    dDay: 78,
  }
];

// 날짜 문자열 정규화: '15:15' 같은 당일 시간 표기는 오늘 날짜(YYYY-MM-DD)로 변환
function normalizeDate(rawDate: string): string {
  const trimmed = (rawDate || '').trim();
  if (/^\d{1,2}:\d{1,2}$/.test(trimmed)) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  const cleaned = rawDate.replace(/[^\d.-]/g, '').trim();
  const parts = cleaned.split(/[.-]/).filter(Boolean);
  if (parts.length === 3) {
    const yyyy = parts[0].length === 2 ? `20${parts[0]}` : parts[0];
    const mm = parts[1].padStart(2, '0');
    const dd = parts[2].padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return rawDate.trim() || new Date().toISOString().slice(0, 10);
}

// HTML 본문 정제: 악성 스크립트 제거, 이미지/링크 절대경로 변환, 반응형 스타일 클래스 주입
function sanitizeAndFormatContentHtml($: cheerio.CheerioAPI, $container: cheerio.Cheerio<any>): string {
  if (!$container.length) return '';

  // 1. 위험/불필요 태그 및 SNS 공유 스크립트 제거
  $container.find('script, style, iframe, object, embed, noscript, .pageSNSShare, [class*="sns"], [id*="sns"]').remove();

  // 2. 인라인 이벤트 핸들러(onclick 등) 제거
  $container.find('*').each((_, el) => {
    const attribs = (el as any).attribs || {};
    for (const attr of Object.keys(attribs)) {
      if (attr.toLowerCase().startsWith('on')) {
        $(el).removeAttr(attr);
      }
    }
  });

  // 3. 이미지 태그 절대경로 변환 및 모바일 반응형 클래스 부여
  $container.find('img').each((_, el) => {
    const $img = $(el);
    let src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-original') || '';
    if (src) {
      if (!src.startsWith('http')) {
        src = `${DSU_BASE_URL}${src.startsWith('/') ? '' : '/'}${src}`;
      }
      $img.attr('src', src);
      $img.removeAttr('width');
      $img.removeAttr('height');
      $img.removeAttr('org_width');
      $img.removeAttr('org_height');
      $img.removeAttr('zoomview');
      $img.addClass('max-w-full h-auto rounded-xl my-3 shadow-sm mx-auto block');
    }
  });

  // 4. 링크 태그 절대경로 변환 및 새 창 열기 속성
  $container.find('a').each((_, el) => {
    const $a = $(el);
    let href = $a.attr('href') || '';
    if (href && !href.startsWith('http') && !href.startsWith('mailto:') && !href.startsWith('tel:') && !href.startsWith('#')) {
      $a.attr('href', `${DSU_BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`);
    }
    $a.attr('target', '_blank');
    $a.attr('rel', 'noopener noreferrer');
    $a.addClass('text-dongseo-700 underline underline-offset-2');
  });

  // 5. 빈 에디터 여백 태그 정리
  $container.find('div.cs-editor-outp').each((_, el) => {
    if (!$(el).text().trim() && !$(el).find('img').length && !$(el).find('table').length) {
      $(el).remove();
    }
  });

  // 6. 표(Table) 태그 반응형 클래스 주입
  $container.find('table').each((_, el) => {
    $(el).addClass('w-full border-collapse my-3 text-xs');
  });

  return $container.html() || '';
}

// 공지사항 스크래핑 함수 (동서대 홈페이지)
export async function scrapeDongseoNotices(category: NoticeCategory = '전체'): Promise<Notice[]> {
  try {
    const pCode = PCODE_MAP[category] || 'MN2000194';
    const targetUrl = `${DSU_BASE_URL}/kr/?pCode=${pCode}`;

    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      next: { revalidate: 300 }, // 5분 캐시
    });

    if (!res.ok) {
      console.warn(`[DSU Crawler] Failed to fetch live notices, HTTP status: ${res.status}`);
      return filterMockNotices(category);
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const notices: Notice[] = [];

    // 동서대학교 일반 공지사항 게시판 tr 파싱
    $('table.bbs_list tbody tr, table.board_list tbody tr, .board_list table tbody tr, table.list_table tbody tr, table tbody tr, .board_list tr').each((i, el) => {
      const $row = $(el);

      // 번호 칸(첫 번째 td) 검사: '공지' 뱃지 글인지 확인
      const firstTd = $row.find('td').first();
      const numText = firstTd.text().replace(/\s+/g, '').trim();
      const isPinned = numText.includes('공지') || 
                       $row.hasClass('notice') || 
                       $row.find('.icon_notice, .notice_icon, .noti, img[alt*="공지"]').length > 0;

      // 👈 사용자의 요청: 상단 고정 '공지' 글은 무시하고, '838' 같은 순수 숫자 번호 글부터 수집!
      if (isPinned || !/^\d+$/.test(numText)) {
        return; // 건너뛰기
      }

      const titleLink = $row.find('td.title a, td.subject a, td.tit a, a.tit, a[href*="idx="], a[href*="mode=view"]').first();
      const title = titleLink.text().trim();
      const href = titleLink.attr('href') || '';
      
      const author = $row.find('td.name, td.writer, td.author, .writer').text().trim() || '동서대학교';
      const rawDate = $row.find('td.date, td.reg_date, td.regdate, .date').text().trim();
      const date = normalizeDate(rawDate);
      const viewsStr = $row.find('td.hit, td.view, td.count, .hit').text().trim();
      const views = parseInt(viewsStr.replace(/[^\d]/g, ''), 10) || 0;

      // idx 파싱
      const urlParams = new URLSearchParams(href.replace(/^.*\?/, ''));
      const idx = urlParams.get('idx') || `crawled-${numText || i}`;

      if (title) {
        notices.push({
          id: idx,
          title,
          category,
          author,
          date,
          views,
          isPinned,
          source: 'homepage',
          url: href.startsWith('http') ? href : `${DSU_BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`,
        });
      }
    });

    if (notices.length === 0) {
      console.warn('[DSU Crawler] No notices parsed from HTML selector, falling back to mock data');
      return filterMockNotices(category);
    }

    return notices;
  } catch (error) {
    console.error('[DSU Crawler Error]', error);
    return filterMockNotices(category);
  }
}

// 공지사항 상세 본문 인앱 파싱
export async function scrapeNoticeDetail(
  id: string,
  pCodeFallback = 'MN2000194',
  explicitUrl?: string
): Promise<Notice | null> {
  // 목업에 존재하는지 우선 확인
  const mockFound = MOCK_NOTICES.find(n => n.id === id);
  if (mockFound) {
    return mockFound;
  }

  const pCodesToTry = explicitUrl
    ? []
    : Array.from(new Set([pCodeFallback, 'MN2000194', 'MN2000191', 'MN2000192', 'MN2000195', 'MN2000197']));

  const urlsToTry: { url: string; pCode?: string }[] = [];
  if (explicitUrl) {
    const fullUrl = explicitUrl.startsWith('http')
      ? explicitUrl
      : `${DSU_BASE_URL}${explicitUrl.startsWith('/') ? '' : '/'}${explicitUrl}`;
    urlsToTry.push({ url: fullUrl, pCode: pCodeFallback });
  }
  for (const p of pCodesToTry) {
    urlsToTry.push({
      url: `${DSU_BASE_URL}/kr/?pCode=${p}&mode=view&idx=${id}`,
      pCode: p,
    });
  }

  const REVERSE_CATEGORY: Record<string, NoticeCategory> = {
    'MN2000194': '학사',
    'MN2000191': '행사',
    'MN2000192': '일반',
    'MN2000195': '장학',
    'MN2000197': '취업',
  };

  for (const item of urlsToTry) {
    try {
      const res = await fetch(item.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        },
        next: { revalidate: 3600 },
      });

      if (!res.ok) continue;

      const html = await res.text();
      const $ = cheerio.load(html);

      // 본문 컨테이너 탐색
      const $content = $('#boardContents').length 
        ? $('#boardContents') 
        : $('.board-view-contents, .board-view-cont, .view_con, .view_content, .board_view').first();

      if (!$content.length && urlsToTry.length > 1) {
        continue; // 다른 카테고리 게시판일 가능성 -> 다음 후보 시도
      }

      const title = $('.view_tit, .view_title, .board_view h3, .view-title').first().text().trim() || '동서대학교 공지사항';
      const author = $('.view_info .writer, .info .author, .writer').first().text().trim() || '동서대학교';
      const rawDate = $('.view_info .date, .info .date, .date').first().text().trim();
      const date = normalizeDate(rawDate);
      const viewsStr = $('.view_info .hit, .info .hit, .hit').first().text().trim();
      const views = parseInt(viewsStr.replace(/[^\d]/g, ''), 10) || 100;

      const contentHtml = sanitizeAndFormatContentHtml($, $content);
      let contentText = $content.text().replace(/\s+/g, ' ').trim() || '';
      if (!contentText && $content.find('img').length > 0) {
        contentText = '본 공지사항은 포스터 이미지로 제공됩니다. 아래 포스터와 학교 공식 홈페이지 링크를 확인해 주세요.';
      }

      // 첨부파일 파싱
      const attachments: { name: string; url: string; size?: string }[] = [];
      $('.file_list li a, .view_file a, .attach_list a').each((_, a) => {
        const $a = $(a);
        const name = $a.text().trim();
        const fileHref = $a.attr('href') || '';
        if (name && fileHref && !fileHref.startsWith('javascript:')) {
          attachments.push({
            name,
            url: fileHref.startsWith('http') ? fileHref : `${DSU_BASE_URL}${fileHref.startsWith('/') ? '' : '/'}${fileHref}`,
          });
        }
      });

      const detectedCategory: NoticeCategory = (item.pCode && REVERSE_CATEGORY[item.pCode]) || '일반';

      return {
        id,
        title,
        category: detectedCategory,
        author,
        date,
        views,
        contentHtml,
        contentText,
        attachments,
        source: 'homepage',
        url: item.url,
      };
    } catch (err) {
      console.warn(`[Notice Detail Scrape Attempt Error for ${item.url}]`, err);
    }
  }

  return mockFound || null;
}

function filterMockNotices(category: NoticeCategory): Notice[] {
  if (category === '전체') {
    return MOCK_NOTICES;
  }
  return MOCK_NOTICES.filter(n => n.category === category);
}
