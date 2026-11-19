import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
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
// 로컬 영구 JSON 데이터베이스 (Supabase 미연동 시 자동 사용, 서버 재시작 후에도 유지)
// ============================================================================
const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'cafeteria-db.json');

interface LocalDbSchema {
  menus: CafeteriaMenu[];
  reviews: MealReview[];
}

function ensureLocalDb(): LocalDbSchema {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const initialData: LocalDbSchema = {
        menus: INITIAL_CAFETERIA_MENUS,
        reviews: INITIAL_MEAL_REVIEWS,
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
      return initialData;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as LocalDbSchema;
    if (!Array.isArray(parsed.menus) || parsed.menus.length === 0) {
      parsed.menus = INITIAL_CAFETERIA_MENUS;
    }
    if (!Array.isArray(parsed.reviews)) {
      parsed.reviews = INITIAL_MEAL_REVIEWS;
    }
    return parsed;
  } catch (err) {
    console.warn('Local DB read failed, using in-memory seed', err);
    return {
      menus: [...INITIAL_CAFETERIA_MENUS],
      reviews: [...INITIAL_MEAL_REVIEWS],
    };
  }
}

function saveLocalDb(data: LocalDbSchema): void {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Local DB write failed', err);
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
  price?: string;
  menu_items?: string[];
  calories?: string;
  sort_order?: number;
};

type MealReviewRow = {
  id: string;
  menu_id: string;
  restaurant: MealReview['restaurant'];
  menu_name?: string;
  nickname?: string;
  date: string;
  student_email_masked: string;
  rating: number;
  comment: string;
  photo_url?: string;
  created_at: string;
  reported?: boolean;
  report_reason?: string;
};

const fromMenuRow = (r: CafeteriaMenuRow): CafeteriaMenu => ({
  id: r.id,
  restaurant: r.restaurant,
  category: r.category,
  name: r.name,
  cornerName: r.category,
  menuItems: r.menu_items && r.menu_items.length > 0 ? r.menu_items : [r.name],
  price: r.price,
  calories: r.calories,
  rating: 0,
  reviewCount: 0,
});

const fromReviewRow = (r: MealReviewRow): MealReview => ({
  id: r.id,
  menuId: r.menu_id,
  restaurant: r.restaurant,
  menuName: r.menu_name,
  nickname: r.nickname,
  date: r.date,
  studentEmailMasked: r.student_email_masked,
  rating: r.rating,
  comment: r.comment,
  photoUrl: r.photo_url,
  createdAt: r.created_at,
  reported: r.reported,
  reportReason: r.report_reason,
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

// ============================================================================
// Public Data Access Functions
// ============================================================================
export async function getCafeteriaMenus(
  restaurant?: string,
  category?: string
): Promise<CafeteriaMenu[]> {
  let menus: CafeteriaMenu[] = [];
  let reviews: MealReview[] = [];

  // 글빌 식당은 크롤링된 주간식단표 txt 파일(data/gv-weekly-menu.txt)을 직접 파싱하여 제공
  if (restaurant === '글빌 식당') {
    const { menus: gvMenus } = readGvWeeklyMenuTxt();
    const db = ensureLocalDb();
    let list = gvMenus.length > 0 ? gvMenus : db.menus.filter((m) => m.restaurant === '글빌 식당');
    if (category && category !== '전체') {
      list = list.filter((m) => m.category === category);
    }
    const gvReviews = await getMealReviews(undefined, '글빌 식당');
    return attachReviewStats(list, gvReviews);
  }

  if (isSupabaseConfigured && supabase) {
    try {
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

      if (!menuErr && menuData && menuData.length > 0) {
        menus = (menuData as CafeteriaMenuRow[]).map(fromMenuRow);
        reviews = revList;
        return attachReviewStats(menus, reviews);
      }
    } catch (e) {
      console.warn('Supabase cafeteria_menus fetch failed, falling back to local DB', e);
    }
  }

  const db = ensureLocalDb();
  menus = [...db.menus];
  if (restaurant) {
    menus = menus.filter((m) => m.restaurant === restaurant);
  }
  if (category && category !== '전체') {
    menus = menus.filter((m) => m.category === category);
  }
  reviews = restaurant
    ? db.reviews.filter((r) => r.restaurant === restaurant)
    : db.reviews;

  return attachReviewStats(menus, reviews);
}

export async function getMealReviews(
  menuId?: string,
  restaurant?: string,
  menuName?: string
): Promise<MealReview[]> {
  if (isSupabaseConfigured && supabase) {
    try {
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
    } catch (e) {
      console.warn('Supabase fetch failed, using local DB reviews', e);
    }
  }

  const db = ensureLocalDb();
  let filtered = [...db.reviews];
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
  const newReview: MealReview = {
    ...review,
    id: `rev-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('meal_reviews')
        .insert([
          {
            menu_id: review.menuId,
            restaurant: review.restaurant,
            menu_name: review.menuName,
            nickname: review.nickname,
            date: review.date,
            student_email_masked: review.studentEmailMasked,
            rating: review.rating,
            comment: review.comment,
            photo_url: review.photoUrl,
          },
        ])
        .select()
        .single();
      if (!error && data) {
        return fromReviewRow(data as MealReviewRow);
      }
    } catch (e) {
      console.warn('Supabase insert failed, storing in local DB', e);
    }
  }

  const db = ensureLocalDb();
  db.reviews.unshift(newReview);
  saveLocalDb(db);
  return newReview;
}

export async function reportMealReview(reviewId: string, reason: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from('meal_reviews')
        .update({ reported: true, report_reason: reason })
        .eq('id', reviewId);
    } catch (e) {
      console.warn('Supabase report update failed', e);
    }
  }

  const db = ensureLocalDb();
  const target = db.reviews.find((r) => r.id === reviewId);
  if (target) {
    target.reported = true;
    target.reportReason = reason;
    saveLocalDb(db);
  }
  return true;
}
