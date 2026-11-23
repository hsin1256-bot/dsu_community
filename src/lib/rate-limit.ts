/**
 * 간단한 메모리 기반 요청 제한 (IP 당 window 안에 limit 회).
 *
 * ⚠️ 서버리스(Vercel)에서는 인스턴스마다 따로 세기 때문에 "대략적인" 제한입니다.
 *    로그인 기능이 붙으면 사용자 단위 제한 또는 Upstash 같은 공용 저장소로 바꾸는 것을 권장합니다.
 */
const buckets = new Map<string, number[]>();

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  return (forwarded?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown').trim();
}

export function checkRateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const recent = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    buckets.set(key, recent);
    return { ok: false, retryAfterSec: Math.ceil((windowMs - (now - recent[0])) / 1000) };
  }
  recent.push(now);
  buckets.set(key, recent);
  // 메모리가 계속 커지지 않도록 가끔 정리
  if (buckets.size > 5000) {
    buckets.forEach((times, k) => {
      if (times.every((t) => now - t >= windowMs)) buckets.delete(k);
    });
  }
  return { ok: true, retryAfterSec: 0 };
}
