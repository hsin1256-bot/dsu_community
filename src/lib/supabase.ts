import { createClient } from '@supabase/supabase-js';
import { CafeteriaMenu, MealReview, RestaurantType } from '@/types';
import { INITIAL_CAFETERIA_MENUS, INITIAL_MEAL_REVIEWS } from '@/lib/cafeteria-seed';
import { readGvWeeklyMenuTxt } from '@/lib/gv-menu-txt';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// ============================================================================
// DB(snake_case) <-> 앱(camelCase) 변환
// ============================================================================
type CafeteriaMenuRow = {
  id: string;
  restaurant: RestaurantType;
  category: string;
  name: string;
  corner_name?: string | null;
  price?: string | null;
  menu_items?: string[] | null;
  calories?: string | null;
  sort_order?: number;
};

type MealReviewRow = {
  id: string;
  user_id?: string | null;
  menu_id: string;
  restaurant: MealReview['restaurant'];
  menu_name?: string | null;
  nickname?: string | null;
  date: string;
  student_email_masked: string;
  rating: number;
  comment: string;
  photo_url?: string | null;
  created_at: string;
  reported?: boolean;
  report_reason?: string | null;
};

const fromMenuRow = (r: CafeteriaMenuRow): CafeteriaMenu => ({
  id: r.id,
  restaurant: r.restaurant,
  category: r.category,
  name: r.name,
  cornerName: r.corner_name || r.category,
  menuItems: r.menu_items && r.menu_items.length > 0 ? r.menu_items : [r.name],
  price: r.price || undefined,
  calories: r.calories || undefined,
  rating: 0,
  reviewCount: 0,
});

const fromReviewRow = (r: MealReviewRow): MealReview => ({
  id: r.id,
  userId: r.user_id ?? null,
  menuId: r.menu_id,
  restaurant: r.restaurant,
  menuName: r.menu_name || undefined,
  nickname: r.nickname || undefined,
  date: r.date,
  studentEmailMasked: r.student_email_masked,
  rating: r.rating,
  comment: r.comment,
  photoUrl: r.photo_url || undefined,
  createdAt: r.created_at,
  reported: r.reported,
  reportReason: r.report_reason || undefined,
});

// 메뉴 목록에 실제 리뷰 기반 평점 & 리뷰 수 계산 반영
function attachReviewStats(menus: CafeteriaMenu[], reviews: MealReview[]): CafeteriaMenu[] {
  return menus.map((menu) => {
    const matched = reviews.filter(
      (r) =>
        r.restaurant === menu.restaurant &&
        (r.menuId === menu.id || (r.menuName && r.menuName === menu.name))
    );
    const reviewCount = matched.length;
    const rating =
      reviewCount > 0
        ? Number((matched.reduce((acc, cur) => acc + cur.rating, 0) / reviewCount).toFixed(1))
        : 0;
    return {
      ...menu,
      rating,
      reviewCount,
    };
  });
}

// 환경변수 미설정 시(예: 최초 빌드)에만 동작하는 읽기 전용 인메모리 폴백
let fallbackReviews: MealReview[] = [...INITIAL_MEAL_REVIEWS];

function getFallbackMenus(restaurant?: string, category?: string): CafeteriaMenu[] {
  let menus: CafeteriaMenu[] = [];
  if (restaurant === '글빌 식당') {
    const { menus: gvMenus } = readGvWeeklyMenuTxt();
    menus = gvMenus.length > 0 ? gvMenus : INITIAL_CAFETERIA_MENUS.filter((m) => m.restaurant === '글빌 식당');
  } else {
    menus = [...INITIAL_CAFETERIA_MENUS];
    if (restaurant) menus = menus.filter((m) => m.restaurant === restaurant);
  }
  if (category && category !== '전체') {
    menus = menus.filter((m) => m.category === category);
  }
  return menus;
}

// ============================================================================
// Public Data Access Functions (Supabase PostgreSQL 우선 사용)
// ============================================================================
export async function getCafeteriaMenus(
  restaurant?: string,
  category?: string
): Promise<CafeteriaMenu[]> {
  if (isSupabaseConfigured && supabase) {
    let menuQuery = supabase
      .from('cafeteria_menus')
      .select('*')
      .order('sort_order', { ascending: true });

    if (restaurant) menuQuery = menuQuery.eq('restaurant', restaurant);
    if (category && category !== '전체') menuQuery = menuQuery.eq('category', category);

    const [{ data: menuData, error: menuErr }, revList] = await Promise.all([
      menuQuery,
      getMealReviews(undefined, restaurant),
    ]);

    if (!menuErr && menuData) {
      const menus = (menuData as CafeteriaMenuRow[]).map(fromMenuRow);
      return attachReviewStats(menus, revList);
    }

    console.error('[Supabase] cafeteria_menus fetch error:', menuErr?.message);
  }

  // 환경변수 미설정/오프라인 시 폴백
  const menus = getFallbackMenus(restaurant, category);
  const revs = restaurant
    ? fallbackReviews.filter((r) => r.restaurant === restaurant)
    : fallbackReviews;
  return attachReviewStats(menus, revs);
}

export async function getMealReviews(
  menuId?: string,
  restaurant?: string,
  menuName?: string
): Promise<MealReview[]> {
  if (isSupabaseConfigured && supabase) {
    let query = supabase
      .from('meal_reviews')
      .select('*')
      .order('created_at', { ascending: false });

    if (restaurant) query = query.eq('restaurant', restaurant);
    if (menuId && !menuName) query = query.eq('menu_id', menuId);

    const { data, error } = await query;
    if (!error && data) {
      let rows = (data as MealReviewRow[]).map(fromReviewRow);
      if (menuId || menuName) {
        rows = rows.filter(
          (r) =>
            (menuId && r.menuId === menuId) ||
            (menuName && r.menuName === menuName)
        );
      }
      return rows;
    }

    console.error('[Supabase] meal_reviews fetch error:', error?.message);
  }

  let filtered = [...fallbackReviews];
  if (restaurant) filtered = filtered.filter((r) => r.restaurant === restaurant);
  if (menuId || menuName) {
    filtered = filtered.filter(
      (r) =>
        (menuId && r.menuId === menuId) ||
        (menuName && r.menuName === menuName)
    );
  }
  return filtered;
}

export async function addMealReview(
  review: Omit<MealReview, 'id' | 'createdAt'>
): Promise<MealReview> {
  const reviewId = `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('meal_reviews')
      .insert([
        {
          id: reviewId,
          user_id: review.userId ?? null,
          menu_id: review.menuId,
          restaurant: review.restaurant,
          menu_name: review.menuName || '',
          nickname: review.nickname || '동서대 학우',
          date: review.date,
          student_email_masked: review.studentEmailMasked,
          rating: review.rating,
          comment: review.comment,
          photo_url: review.photoUrl || null,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('[Supabase] meal_reviews insert error:', error.message);
      throw new Error(`Supabase 리뷰 저장 실패: ${error.message}`);
    }
    return fromReviewRow(data as MealReviewRow);
  }

  const newReview: MealReview = {
    ...review,
    id: reviewId,
    createdAt: new Date().toISOString(),
  };
  fallbackReviews.unshift(newReview);
  return newReview;
}

export async function reportMealReview(reviewId: string, reason: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from('meal_reviews')
      .update({ reported: true, report_reason: reason })
      .eq('id', reviewId);

    if (error) {
      console.error('[Supabase] meal_reviews report error:', error.message);
      throw new Error(`Supabase 신고 처리 실패: ${error.message}`);
    }
    return true;
  }

  const target = fallbackReviews.find((r) => r.id === reviewId);
  if (target) {
    target.reported = true;
    target.reportReason = reason;
  }
  return true;
}
