import { CafeteriaMenu, MealReview, RestaurantType } from '@/types';
import { INITIAL_CAFETERIA_MENUS, INITIAL_MEAL_REVIEWS } from '@/lib/cafeteria-seed';
import { readGvWeeklyMenuTxt } from '@/lib/gv-menu-txt';
import { randomUUID } from 'crypto';
import { supabase, isSupabaseConfigured, createAuthedClient, getSupabaseAdmin } from '@/lib/supabase-client';

export const REVIEW_PHOTOS_BUCKET = 'review-photos';

// 화면(클라이언트)은 읽기 전용으로 유지하고, 모든 DB/Storage 쓰기는 서버 API 라우트에서만 허용
function assertServerOnlyWrite(operationName: string): void {
  if (typeof window !== 'undefined') {
    throw new Error(`[Security] ${operationName}는 서버 API 라우트에서만 호출할 수 있습니다.`);
  }
}

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
      .order('created_at', { ascending: false })
      .limit(500); // 리뷰가 쌓여도 한 번에 전체 테이블을 읽지 않도록 상한

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

/**
 * 리뷰 저장: 서버 API 가 입력을 검증한 뒤 service role 로만 저장합니다.
 * (DB 에서는 anon/authenticated 의 직접 INSERT 를 막아 두었음 → migration 20261124000002)
 */
export async function addMealReview(
  review: Omit<MealReview, 'id' | 'createdAt'>
): Promise<MealReview> {
  assertServerOnlyWrite('addMealReview');
  const reviewId = `rev-${randomUUID()}`;

  if (isSupabaseConfigured) {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error('SUPABASE_SERVICE_ROLE_KEY 가 없어 리뷰를 저장할 수 없습니다.');
    const { data, error } = await admin
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
      if (error.code === '23503') throw new Error('존재하지 않는 메뉴입니다.');
      throw new Error('리뷰 저장에 실패했습니다.');
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

/** 신고 접수: 서버가 확인한 사용자 id 로 service role 저장 (직접 INSERT 차단) */
export async function reportMealReview(
  reviewId: string,
  reason: string,
  reporterUserId?: string | null
): Promise<boolean> {
  assertServerOnlyWrite('reportMealReview');
  if (isSupabaseConfigured) {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error('SUPABASE_SERVICE_ROLE_KEY 가 없어 신고를 저장할 수 없습니다.');
    const { error } = await admin.from('review_reports').insert([
      {
        review_id: reviewId,
        reporter_user_id: reporterUserId ?? null,
        reason: reason.trim(),
        status: 'pending',
      },
    ]);

    if (error) {
      if (error.code === '23505') throw new Error('이미 신고하신 리뷰입니다.');
      if (error.code === '23503') throw new Error('존재하지 않는 리뷰입니다.');
      console.error('[Supabase] review_reports insert error:', error.message);
      throw new Error('신고 접수에 실패했습니다.');
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

export async function updateOwnMealReview(
  reviewId: string,
  updates: { rating: number; comment: string },
  accessToken: string
): Promise<MealReview> {
  assertServerOnlyWrite('updateOwnMealReview');
  if (!isSupabaseConfigured) {
    throw new Error('Supabase가 설정되지 않았습니다.');
  }
  const authedClient = createAuthedClient(accessToken);

  if (!authedClient) throw new Error('Supabase가 설정되지 않았습니다.');
  const { data, error } = await authedClient
    .from('meal_reviews')
    .update({
      rating: updates.rating,
      comment: updates.comment.trim(),
    })
    .eq('id', reviewId)
    .select()
    .single();

  if (error || !data) {
    throw new Error('본인이 작성한 리뷰만 수정할 수 있습니다.');
  }
  return fromReviewRow(data as MealReviewRow);
}

export async function deleteOwnMealReview(
  reviewId: string,
  accessToken: string
): Promise<boolean> {
  assertServerOnlyWrite('deleteOwnMealReview');
  if (!isSupabaseConfigured) {
    throw new Error('Supabase가 설정되지 않았습니다.');
  }
  const authedClient = createAuthedClient(accessToken);

  if (!authedClient) throw new Error('Supabase가 설정되지 않았습니다.');
  const { data, error } = await authedClient
    .from('meal_reviews')
    .delete()
    .eq('id', reviewId)
    .select('id');

  // RLS 로 막히면 오류 없이 0건 삭제되므로 결과 건수까지 확인
  if (error || !data || data.length === 0) {
    throw new Error('본인이 작성한 리뷰만 삭제할 수 있습니다.');
  }
  return true;
}

/** 리뷰 사진 업로드: 서버가 파일 내용을 검사한 뒤 service role 로만 업로드 (Storage 직접 업로드 차단) */
export async function uploadReviewPhoto(
  fileBuffer: Buffer,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
): Promise<string> {
  assertServerOnlyWrite('uploadReviewPhoto');
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('Supabase Storage 가 설정되지 않았습니다.');

  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[mimeType];
  const monthPrefix = new Date().toISOString().slice(0, 7); // YYYY-MM
  const objectPath = `reviews/${monthPrefix}/${randomUUID()}.${ext}`;

  const { error: uploadError } = await admin.storage
    .from(REVIEW_PHOTOS_BUCKET)
    .upload(objectPath, fileBuffer, { contentType: mimeType, cacheControl: '3600', upsert: false });

  if (uploadError) {
    console.error('[Supabase Storage] upload error:', uploadError.message);
    throw new Error('사진 업로드에 실패했습니다.');
  }

  const { data } = admin.storage.from(REVIEW_PHOTOS_BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}

/** 우리 Storage 버킷의 공개 URL 인지 확인 (외부 이미지 주소를 리뷰에 넣지 못하게) */
export function isOwnReviewPhotoUrl(url: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  if (!base) return false;
  const prefix = `${base.replace(/\/$/, '')}/storage/v1/object/public/${REVIEW_PHOTOS_BUCKET}/reviews/`;
  return url.startsWith(prefix) && !url.includes('..');
}
