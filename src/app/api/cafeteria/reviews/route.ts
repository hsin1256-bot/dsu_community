import { NextRequest, NextResponse } from 'next/server';
import {
  getMealReviews,
  addMealReview,
  reportMealReview,
  updateOwnMealReview,
  deleteOwnMealReview,
} from '@/lib/supabase';
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { menuId, restaurant, menuName, nickname, date, email, rating, comment, photoUrl } = body;

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ success: false, error: '1~5점 사이의 별점을 입력해 주세요.' }, { status: 400 });
    }

    if (!comment || comment.trim().length < 2) {
      return NextResponse.json({ success: false, error: '최소 2자 이상의 리뷰를 입력해 주세요.' }, { status: 400 });
    }

    // DB 용량 보호: base64(data:) 직접 저장 차단, http(s) URL만 허용
    if (photoUrl) {
      if (typeof photoUrl !== 'string' || photoUrl.trim().toLowerCase().startsWith('data:')) {
        return NextResponse.json(
          { success: false, error: '사진은 Storage 업로드 후 URL 주소만 저장할 수 있습니다.' },
          { status: 400 }
        );
      }
      if (!/^https?:\/\//i.test(photoUrl.trim())) {
        return NextResponse.json(
          { success: false, error: '올바른 이미지 URL 형식이 아닙니다.' },
          { status: 400 }
        );
      }
    }

    // 단일 진입점(getCurrentUser)으로 현재 로그인 사용자 조회 (비로그인 시 userId: null)
    const currentUser = await getCurrentUser(req);
    const resolvedNickname =
      (nickname && nickname.trim()) || currentUser.nickname || '동서대 학우';
    const resolvedEmail = email || currentUser.email || undefined;
    const masked = maskDongseoEmail(resolvedEmail, resolvedNickname);

    const created = await addMealReview({
      userId: currentUser.id,
      menuId: menuId || 'general',
      restaurant: (restaurant || '글빌 식당') as RestaurantType,
      menuName: menuName || '',
      nickname: resolvedNickname,
      date: date || todayKST(),
      studentEmailMasked: masked,
      rating: Number(rating),
      comment: comment.trim(),
      photoUrl: photoUrl || undefined,
    });

    return NextResponse.json({ success: true, data: created });
  } catch (error) {
    return NextResponse.json({ success: false, error: '리뷰 등록 중 문제가 발생했습니다.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { reviewId, reason } = body;

    if (!reviewId) {
      return NextResponse.json({ success: false, error: '리뷰 ID가 필요합니다.' }, { status: 400 });
    }

    const currentUser = await getCurrentUser(req);
    const authHeader = req.headers.get('authorization');
    const accessToken = authHeader?.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : null;

    await reportMealReview(
      reviewId,
      reason || '부적절한 리뷰',
      currentUser.id,
      accessToken
    );
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
    if (!reviewId || !rating || rating < 1 || rating > 5 || !comment || comment.trim().length < 2) {
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
