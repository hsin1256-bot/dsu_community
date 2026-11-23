import { NextRequest, NextResponse } from 'next/server';
import { insertFeedback, FEEDBACK_CATEGORIES, FeedbackCategory } from '@/lib/db/feedback';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { getCurrentUser } from '@/lib/current-user';
import { APP_VERSION } from '@/lib/app-info';

const MESSAGE_MIN = 5;
const MESSAGE_MAX = 2000;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** 문의 및 피드백 접수: POST { category, message, contactEmail?, pagePath?, website(허니팟) } */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ success: false, error: '잘못된 요청입니다.' }, { status: 400 });
  }
  const { category, message, contactEmail, pagePath, website } = body as Record<string, unknown>;

  // 허니팟: 사람에게는 보이지 않는 칸. 값이 있으면 자동 스팸으로 보고 저장하지 않음 (성공처럼 응답)
  if (typeof website === 'string' && website.trim() !== '') {
    return NextResponse.json({ success: true });
  }

  if (typeof category !== 'string' || !(category in FEEDBACK_CATEGORIES)) {
    return NextResponse.json({ success: false, error: '문의 종류를 선택해 주세요.' }, { status: 400 });
  }
  if (typeof message !== 'string' || message.trim().length < MESSAGE_MIN || message.length > MESSAGE_MAX) {
    return NextResponse.json(
      { success: false, error: `내용은 ${MESSAGE_MIN}자 이상 ${MESSAGE_MAX}자 이하로 입력해 주세요.` },
      { status: 400 }
    );
  }
  const email = typeof contactEmail === 'string' ? contactEmail.trim() : '';
  if (email && (email.length > 100 || !EMAIL_RE.test(email))) {
    return NextResponse.json({ success: false, error: '답변받을 이메일 형식이 올바르지 않습니다.' }, { status: 400 });
  }
  const path = typeof pagePath === 'string' && pagePath.startsWith('/') ? pagePath.slice(0, 200) : null;

  // 같은 IP 에서 10분에 3건까지 (도배 방지 — 입력 오류로 다시 보내는 경우는 세지 않도록 검증 뒤에 확인)
  const limit = checkRateLimit(`feedback:${getClientIp(req)}`, 3, 10 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { success: false, error: `잠시 후 다시 보내 주세요. (${Math.ceil(limit.retryAfterSec / 60)}분 후 가능)` },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } }
    );
  }

  try {
    const user = await getCurrentUser(req);
    await insertFeedback({
      category: category as FeedbackCategory,
      message: message.trim(),
      contactEmail: email || null,
      pagePath: path,
      appVersion: APP_VERSION,
      userId: user.id,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[feedback POST]', err);
    return NextResponse.json({ success: false, error: '접수 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
}
