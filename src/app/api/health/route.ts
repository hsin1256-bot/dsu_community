import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured, supabaseUrl, getSupabaseAdmin } from '@/lib/supabase-client';

export const dynamic = 'force-dynamic';

const EXPECTED_PROJECT_REF = 'lgphijmhyenycysmtjre'; // 팀 공용 dsu_community 프로젝트

/**
 * 개발용 연결 상태 확인: http://localhost:3000/api/health
 * - 어느 Supabase 프로젝트에 붙었는지, 테이블별로 읽히는 행 수, 서버 키 유무를 보여줍니다.
 * - 키 값은 절대 보여주지 않습니다. 배포 환경(production)에서는 404.
 */
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const projectRef = supabaseUrl.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] ?? null;
  const tables = ['notices', 'academic_schedules', 'cafeteria_menus', 'meal_reviews'] as const;
  const counts: Record<string, number | string> = {};

  const client = supabase;
  if (isSupabaseConfigured && client) {
    await Promise.all(
      tables.map(async (t) => {
        const { count, error } = await client.from(t).select('*', { count: 'exact', head: true });
        counts[t] = error ? `오류: ${error.message || error.code || '연결 거부 (URL과 키가 같은 프로젝트 것인지 확인)'}` : count ?? 0;
      })
    );
  }

  const problems: string[] = [];
  if (!isSupabaseConfigured) problems.push('.env.local 에 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.');
  else if (projectRef !== EXPECTED_PROJECT_REF)
    problems.push(`팀 공용 프로젝트(${EXPECTED_PROJECT_REF})가 아닌 다른 프로젝트(${projectRef})에 연결돼 있습니다. .env.local 의 URL·키를 확인하세요.`);
  for (const t of tables) {
    if (typeof counts[t] === 'string') problems.push(`${t} 테이블을 읽지 못했습니다: ${counts[t]}`);
  }
  if (counts.academic_schedules === 0 || counts.notices === 0) problems.push('공지 또는 학사일정이 비어 있습니다. 서버 키가 있는 사람이 npm run sync:local 을 실행해야 합니다.');

  return NextResponse.json(
    {
      ok: problems.length === 0,
      supabaseConfigured: isSupabaseConfigured,
      projectRef,
      expectedProjectRef: EXPECTED_PROJECT_REF,
      serverKeyPresent: Boolean(getSupabaseAdmin()),
      rowCounts: counts,
      problems,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
