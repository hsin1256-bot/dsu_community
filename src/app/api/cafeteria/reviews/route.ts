import { NextRequest, NextResponse } from 'next/server';
import { getMealReviews, addMealReview, reportMealReview } from '@/lib/supabase';
import { RestaurantType } from '@/types';

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

    const masked = maskDongseoEmail(email, nickname);

    const created = await addMealReview({
      menuId: menuId || 'general',
      restaurant: (restaurant || '글빌 식당') as RestaurantType,
      menuName: menuName || '',
      nickname: nickname ? nickname.trim() : '동서대 학우',
      date: date || new Date().toISOString().slice(0, 10),
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

    await reportMealReview(reviewId, reason || '부적절한 리뷰');
    return NextResponse.json({ success: true, message: '신고가 정상적으로 접수되었습니다.' });
  } catch (error) {
    return NextResponse.json({ success: false, error: '신고 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
