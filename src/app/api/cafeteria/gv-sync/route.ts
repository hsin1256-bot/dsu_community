import { NextResponse } from 'next/server';
import { crawlLatestGvMenuImage, readGvWeeklyMenuTxt } from '@/lib/gv-menu-txt';

// 매주 금요일 12:00~15:00 글로벌빌리지 식단표 이미지 크롤링 상태 확인 & TXT 반환 API
// 응답 자체도 10분간 캐시 (외부에서 반복 호출해도 학교 사이트로 요청이 몰리지 않도록)
export const revalidate = 600;

export async function GET() {
  try {
    const { meta, menus, rawText } = readGvWeeklyMenuTxt();
    let crawlStatus = null;

    try {
      crawlStatus = await crawlLatestGvMenuImage();
    } catch (e) {
      crawlStatus = { error: '외부 사이트 연결 대기 중 (로컬 txt 파일 사용)' };
    }

    return NextResponse.json({
      success: true,
      meta,
      menuCount: menus.length,
      crawlStatus,
      rawText,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: '글빌 식단표 동기화 확인 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
