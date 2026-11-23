import { NextRequest, NextResponse } from 'next/server';
import { getCafeteriaMenus } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const restaurant = searchParams.get('restaurant') || undefined;
  const category = searchParams.get('category') || undefined;

  try {
    const list = await getCafeteriaMenus(restaurant, category);

    // 해당 식당에 존재하는 카테고리 목록(순서 유지)
    const allForRestaurant = category && category !== '전체'
      ? await getCafeteriaMenus(restaurant)
      : list;
    const categories = Array.from(new Set(allForRestaurant.map((m) => m.category)));

    return NextResponse.json({
      success: true,
      data: list,
      categories,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: '메뉴 정보를 불러올 수 없습니다.' },
      { status: 500 }
    );
  }
}
