import { NextRequest, NextResponse } from 'next/server';
import { runNoticeSyncPipeline } from '@/lib/notice-pipeline';
import { NoticeCategory } from '@/types';

export async function POST(req: NextRequest) {
  try {
    let category: NoticeCategory = '전체';
    let limit = 10;

    try {
      const body = await req.json();
      if (body.category) category = body.category;
      if (body.limit) limit = Number(body.limit);
    } catch {
      // Body가 없는 경우 기본값 사용
    }

    const result = await runNoticeSyncPipeline(category, limit);

    return NextResponse.json({
      success: true,
      message: `${result.newProcessed}건의 신규 공지가 LLM 요약 및 DB 저장을 완료했습니다. (${result.skipped}건 기저장 스킵)`,
      result,
    });
  } catch (error: any) {
    console.error('[Sync Route Error]', error);
    return NextResponse.json(
      { success: false, error: error.message || '동기화 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  // 브라우저에서 가볍게 테스트할 수 있도록 GET도 지원
  const { searchParams } = new URL(req.url);
  const category = (searchParams.get('category') || '전체') as NoticeCategory;
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  try {
    const result = await runNoticeSyncPipeline(category, limit);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
