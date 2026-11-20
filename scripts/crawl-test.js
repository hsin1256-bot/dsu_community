/**
 * 동서대학교 학사 공지사항(MN2000194) 전용 크롤러 테스트 스크립트
 * 대상 URL: https://www.dongseo.ac.kr/kr/?pCode=MN2000194
 */

const cheerio = require('cheerio');

const TARGET_URL = 'https://www.dongseo.ac.kr/kr/?pCode=MN2000194';
const DSU_BASE_URL = 'https://www.dongseo.ac.kr';

async function crawlDongseoAcademicNotices() {
  console.log(`\n======================================================`);
  console.log(`[크롤링 시작] 동서대학교 학사 공지사항`);
  console.log(`대상 URL: ${TARGET_URL}`);
  console.log(`======================================================\n`);

  try {
    const res = await fetch(TARGET_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    console.log(`HTTP 상태 코드: ${res.status} ${res.statusText}`);
    if (!res.ok) {
      console.error(`서버 접속 실패! HTTP 상태: ${res.status}`);
      return;
    }

    const html = await res.text();
    console.log(`수신한 HTML 크기: ${(html.length / 1024).toFixed(1)} KB\n`);

    const $ = cheerio.load(html);
    const notices = [];

    // 동서대학교 게시판 테이블 행 탐색 (다양한 셀렉터 우선순위 매칭)
    const rowSelectors = [
      'table.bbs_list tbody tr',
      'table.board_list tbody tr',
      'table.list_table tbody tr',
      '.board_list tbody tr',
      'table tbody tr',
      '.board_list li',
    ];

    let $rows = null;
    let matchedSelector = '';
    for (const sel of rowSelectors) {
      const found = $(sel);
      if (found.length > 0) {
        $rows = found;
        matchedSelector = sel;
        break;
      }
    }

    if (!$rows || $rows.length === 0) {
      console.error('❌ 게시판 목록 요소를 찾지 못했습니다.');
      return;
    }

    console.log(`✅ 일치한 목록 선택자: "${matchedSelector}" (총 ${$rows.length}개 행 발견)\n`);

    $rows.each((i, el) => {
      const $row = $(el);

      // 상단 고정(필독) 여부
      const isPinned = $row.hasClass('notice') || 
                       $row.find('.icon_notice, .notice_icon, .noti, img[alt*="공지"]').length > 0;

      // 제목 및 링크 탐색
      const titleLink = $row.find('td.title a, td.subject a, td.tit a, a.tit, a[href*="idx="], a[href*="mode=view"]').first();
      const rawTitle = titleLink.text().replace(/\s+/g, ' ').trim();
      const href = titleLink.attr('href') || '';

      // 작성자, 작성일, 조회수 탐색
      const author = $row.find('td.name, td.writer, td.author, .writer').text().trim() || '동서대학교';
      const rawDate = $row.find('td.date, td.reg_date, td.regdate, .date').text().trim();
      const viewsStr = $row.find('td.hit, td.view, td.count, .hit').text().trim();
      const views = parseInt(viewsStr.replace(/[^\d]/g, ''), 10) || 0;

      // idx (글 고유번호) 추출
      const urlParams = new URLSearchParams(href.replace(/^.*\?/, ''));
      const idx = urlParams.get('idx') || '';

      // 절대 경로 URL 생성
      let fullUrl = href;
      if (href && !href.startsWith('http')) {
        fullUrl = `${DSU_BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`;
      }

      if (rawTitle) {
        notices.push({
          num: i + 1,
          idx,
          isPinned,
          title: rawTitle,
          author,
          date: rawDate,
          views,
          url: fullUrl,
        });
      }
    });

    console.log(`📋 [추출된 공지사항 목록 (상위 5건)]`);
    notices.slice(0, 5).forEach((n) => {
      console.log(`------------------------------------------------------`);
      console.log(`[${n.num}] ${n.isPinned ? '📌 [필독] ' : ''}${n.title}`);
      console.log(`     작성일: ${n.date} | 작성자: ${n.author} | 조회수: ${n.views} | 글번호(idx): ${n.idx}`);
      console.log(`     링크: ${n.url}`);
    });
    console.log(`------------------------------------------------------\n`);

    // 1개 글을 선택하여 상세 본문 및 이미지, 첨부파일 크롤링 테스트
    const sampleNotice = notices.find(n => n.idx) || notices[0];
    if (sampleNotice && sampleNotice.idx) {
      await crawlNoticeDetail(sampleNotice.idx);
    }
  } catch (error) {
    console.error('크롤링 중 에러 발생:', error);
  }
}

// 상세 본문 크롤링 함수
async function crawlNoticeDetail(idx) {
  const detailUrl = `https://www.dongseo.ac.kr/kr/?pCode=MN2000194&mode=view&idx=${idx}`;
  console.log(`\n======================================================`);
  console.log(`[상세 본문 크롤링 테스트] 글번호: ${idx}`);
  console.log(`URL: ${detailUrl}`);
  console.log(`======================================================`);

  try {
    const res = await fetch(detailUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) {
      console.error(`상세 페이지 접속 실패 (HTTP ${res.status})`);
      return;
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // 상세 본문 제목, 작성자, 작성일
    const title = $('.view_tit, .view_title, .board_view h3, .view-title').first().text().trim();
    const author = $('.view_info .writer, .info .author, .writer').first().text().trim();
    const date = $('.view_info .date, .info .date, .date').first().text().trim();

    // 본문 컨테이너
    const $content = $('.view_con, .view_content, .board_view_cont, .view-content, .board_view, #board_view_cont, .bbs_content').first();
    const contentText = $content.text().replace(/\s+/g, ' ').trim();

    console.log(`제목: ${title}`);
    console.log(`작성일: ${date} | 작성자: ${author}`);
    console.log(`본문 글자 수: ${contentText.length} 자`);
    console.log(`\n[본문 미리보기 (앞 200자)]`);
    console.log(contentText.slice(0, 200) + '...\n');

    // 이미지 추출 (절대경로 확인)
    const images = [];
    $content.find('img').each((_, img) => {
      let src = $(img).attr('src') || '';
      if (src && !src.startsWith('http')) {
        src = `${DSU_BASE_URL}${src.startsWith('/') ? '' : '/'}${src}`;
      }
      if (src) images.push(src);
    });
    console.log(`발견된 본문 이미지 (${images.length}개):`, images);

    // 첨부파일 추출
    const attachments = [];
    $('a[href*="download"], a[href*="file"], .file_list a, .view_file a, .attach_list a').each((_, a) => {
      const name = $(a).text().trim();
      let href = $(a).attr('href') || '';
      if (name && href && !href.startsWith('javascript:')) {
        if (!href.startsWith('http')) {
          href = `${DSU_BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`;
        }
        attachments.push({ name, url: href });
      }
    });
    console.log(`발견된 첨부파일 (${attachments.length}개):`, attachments);

    console.log(`\n======================================================`);
    console.log(`✅ https://www.dongseo.ac.kr/kr/?pCode=MN2000194 크롤링 검증 완료!`);
    console.log(`======================================================\n`);
  } catch (err) {
    console.error('상세 본문 크롤링 에러:', err);
  }
}

crawlDongseoAcademicNotices();
