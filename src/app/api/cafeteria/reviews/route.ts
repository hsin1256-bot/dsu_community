import { NextRequest, NextResponse } from 'next/server';
import {
  getMealReviews,
  addMealReview,
  reportMealReview,
  updateOwnMealReview,
  deleteOwnMealReview,
  isOwnReviewPhotoUrl,
} from '@/lib/db/cafeteria';
import { getCurrentUser } from '@/lib/current-user';
import { RestaurantType } from '@/types';
import { todayKST } from '@/lib/date-kst';

function maskDongseoEmail(email?: string, nickname?: string): string {
  if (nickname && nickname.trim()) {
    return nickname.trim();
  }
  if (!email) return '동서대 재학생';
  const parts = email.split('@');
  if (parts.length !== 2) return `${email.slice(0, 3)}***`;
  const username = parts[0];
  const domain = parts[1];
  if (username.length <= 2) {
    return `${username}*@${domain}`;
  }
  return `${username.slice(0, 3)}***@${domain}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const menuId = searchParams.get('menuId') || undefined;
  const restaurant = searchParams.get('restaurant') || undefined;
  const menuName = searchParams.get('menuName') || undefined;

  try {
    const reviews = await getMealReviews(menuId, restaurant, menuName);
    return NextResponse.json({ success: true, data: reviews });
  } catch (error) {
    return NextResponse.json({ success: false, error: '리뷰를 불러올 수 없습니다.' }, { status: 500 });
  }
}

const RESTAURANTS: RestaurantType[] = ['글빌 식당', '스플 식당', '경영 식당'];
const LIMITS = { comment: 500, nickname: 20, menuName: 100, reason: 300 };

const isNonEmptyString = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= max;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { menuId, restaurant, menuName, nickname, rating, comment, photoUrl } = body ?? {};
    const ratingNum = Number(rating);

    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return NextResponse.json({ success: false, error: '1~5점 사이의 별점을 입력해 주세요.' }, { status: 400 });
    }
    if (typeof comment !== 'string' || comment.trim().length < 2 || comment.length > LIMITS.comment) {
      return NextResponse.json(
        { success: false, error: `리뷰는 2자 이상 ${LIMITS.comment}자 이하로 입력해 주세요.` },
        { status: 400 }
      );
    }
    if (!isNonEmptyString(menuId, 64) || !RESTAURANTS.includes(restaurant)) {
      return NextResponse.json({ success: false, error: '메뉴 정보가 올바르지 않습니다.' }, { status: 400 });
    }
    if (nickname !== undefined && nickname !== '' && !isNonEmptyString(nickname, LIMITS.nickname)) {
      return NextResponse.json(
        { success: false, error: `닉네임은 ${LIMITS.nickname}자 이하로 입력해 주세요.` },
        { status: 400 }
      );
    }
    // 사진은 우리 /upload API 로 올린 Storage 주소만 허용 (외부 추적 이미지·data: URL 차단)
    if (photoUrl && (typeof photoUrl !== 'string' || !isOwnReviewPhotoUrl(photoUrl))) {
      return NextResponse.json({ success: false, error: '사진은 앱에서 업로드한 이미지만 첨부할 수 있습니다.' }, { status: 400 });
    }

    // 이메일 등 사용자 정보는 요청 본문이 아니라 검증된 로그인 토큰에서만 가져옴
    const currentUser = await getCurrentUser(req);
    const resolvedNickname = (typeof nickname === 'string' && nickname.trim()) || currentUser.nickname || '동서대 학우';
    const masked = maskDongseoEmail(currentUser.email || undefined, resolvedNickname);

    const created = await addMealReview({
      userId: currentUser.id,
      menuId: menuId.trim(),
      restaurant,
      menuName: typeof menuName === 'string' ? menuName.slice(0, LIMITS.menuName) : '',
      nickname: resolvedNickname,
      date: todayKST(), // 작성일은 서버가 정함
      studentEmailMasked: masked,
      rating: ratingNum,
      comment: comment.trim(),
      photoUrl: photoUrl || undefined,
    });

    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    console.error('[reviews POST]', error);
    const message = error instanceof Error && error.message === '존재하지 않는 메뉴입니다.' ? error.message : '리뷰 등록 중 문제가 발생했습니다.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { reviewId, reason } = body ?? {};

    if (!isNonEmptyString(reviewId, 64)) {
      return NextResponse.json({ success: false, error: '리뷰 ID가 필요합니다.' }, { status: 400 });
    }
    const reasonText = typeof reason === 'string' && reason.trim().length >= 2 ? reason.trim() : '부적절한 리뷰';
    if (reasonText.length > LIMITS.reason) {
      return NextResponse.json({ success: false, error: `신고 사유는 ${LIMITS.reason}자 이하로 입력해 주세요.` }, { status: 400 });
    }

    const currentUser = await getCurrentUser(req);
    await reportMealReview(reviewId, reasonText, currentUser.id);
    return NextResponse.json({ success: true, message: '신고가 정상적으로 접수되었습니다.' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || '신고 처리 중 오류가 발생했습니다.' },
      { status: 400 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser(req);
    const authHeader = req.headers.get('authorization');
    const accessToken = authHeader?.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : null;

    if (!currentUser.isAuthenticated || !accessToken) {
      return NextResponse.json(
        { success: false, error: '로그인한 본인만 리뷰를 수정할 수 있습니다.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { reviewId, rating, comment } = body;
    if (
      !isNonEmptyString(reviewId, 64) ||
      !Number.isInteger(Number(rating)) ||
      Number(rating) < 1 ||
      Number(rating) > 5 ||
      typeof comment !== 'string' ||
      comment.trim().length < 2 ||
      comment.length > LIMITS.comment
    ) {
      return NextResponse.json(
        { success: false, error: '수정할 리뷰 ID, 별점(1~5), 내용(2자 이상)이 필요합니다.' },
        { status: 400 }
      );
    }

    const updated = await updateOwnMealReview(reviewId, { rating: Number(rating), comment }, accessToken);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || '리뷰 수정 중 오류가 발생했습니다.' },
      { status: 403 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser(req);
    const authHeader = req.headers.get('authorization');
    const accessToken = authHeader?.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : null;

    if (!currentUser.isAuthenticated || !accessToken) {
      return NextResponse.json(
        { success: false, error: '로그인한 본인만 리뷰를 삭제할 수 있습니다.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const reviewId = searchParams.get('reviewId');
    if (!reviewId) {
      return NextResponse.json({ success: false, error: '리뷰 ID가 필요합니다.' }, { status: 400 });
    }

    await deleteOwnMealReview(reviewId, accessToken);
    return NextResponse.json({ success: true, message: '리뷰가 삭제되었습니다.' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || '리뷰 삭제 중 오류가 발생했습니다.' },
      { status: 403 }
    );
  }
}
