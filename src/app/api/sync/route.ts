import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { runNoticeSync } from '@/lib/notice-pipeline';
import { runScheduleSync } from '@/lib/schedule-sync';
import { isSyncableCategory, SYNCABLE_CATEGORIES } from '@/lib/dsu/notice-crawler';
import { getSupabaseAdmin } from '@/lib/supabase-client';

/**
 * 예약 동기화 엔드포인트 (GitHub Actions / Vercel Cron 에서 호출)
 *
 *   GET|POST /api/sync?job=all|notices|schedules&category=학사&limit=15
 *   Authorization: Bearer <CRON_SECRET>
 *
 * CRON_SECRET 이 설정되지 않으면 항상 401 입니다.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get('authorization') || '';
  if (!secret || !header.toLowerCase().startsWith('bearer ')) return false;
  const a = Buffer.from(header.slice(7).trim());
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const job = searchParams.get('job') || 'all';
  const categoryParam = searchParams.get('category');
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '15', 10) || 15));

  if (!['all', 'notices', 'schedules'].includes(job)) {
    return NextResponse.json({ success: false, error: `알 수 없는 job: ${job}` }, { status: 400 });
  }
  if (categoryParam && !isSyncableCategory(categoryParam)) {
    return NextResponse.json({ success: false, error: `알 수 없는 category: ${categoryParam}` }, { status: 400 });
  }

  // 저장할 수 없으면 크롤링·Gemini 호출을 시작하지 않음 (비용/학교 서버 부하 낭비 방지)
  if (!getSupabaseAdmin()) {
    return NextResponse.json(
      { success: false, error: 'SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않아 동기화를 실행할 수 없습니다.' },
      { status: 503 }
    );
  }

  const startedAt = Date.now();
  const notices =
    job === 'all' || job === 'notices'
      ? await runNoticeSync(categoryParam && isSyncableCategory(categoryParam) ? [categoryParam] : SYNCABLE_CATEGORIES, limit)
      : undefined;
  const schedules = job === 'all' || job === 'schedules' ? await runScheduleSync() : undefined;

  const hasError = [...(notices || []), ...(schedules || [])].some((r) => r.error);
  return NextResponse.json(
    { success: !hasError, elapsedMs: Date.now() - startedAt, notices, schedules },
    { status: hasError ? 207 : 200 }
  );
}

export const GET = handle;
export const POST = handle;
