#!/usr/bin/env node
/**
 * 로컬에서 동기화를 한 번 실행합니다. (dev 서버가 켜져 있어야 함: npm run dev)
 *
 *   npm run sync:local                 # 공지 + 학사일정
 *   npm run sync:local -- notices      # 공지만
 *   npm run sync:local -- schedules    # 학사일정만
 *
 * .env.local 의 CRON_SECRET 을 사용합니다. SYNC_BASE_URL 로 대상 주소를 바꿀 수 있습니다.
 */
import { readFileSync, existsSync } from 'node:fs';

function readEnvLocal() {
  if (!existsSync('.env.local')) return {};
  return Object.fromEntries(
    readFileSync('.env.local', 'utf8')
      .split('\n')
      .map((l) => l.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2].replace(/^['"]|['"]$/g, '')])
  );
}

const env = { ...readEnvLocal(), ...process.env };
const job = process.argv[2] || 'all';
const base = env.SYNC_BASE_URL || 'http://localhost:3000';

if (!env.CRON_SECRET) {
  console.error('CRON_SECRET 이 없습니다. .env.local 에 추가해 주세요.');
  process.exit(1);
}

const res = await fetch(`${base}/api/sync?job=${encodeURIComponent(job)}`, {
  headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
});
const body = await res.json().catch(() => ({}));
console.log(JSON.stringify(body, null, 2));
process.exit(res.ok && body.success ? 0 : 1);
