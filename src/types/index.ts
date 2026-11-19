export type NoticeCategory = '전체' | '일반' | '학사' | '장학' | '취업' | '행사';

export interface NoticeAttachment {
  name: string;
  url: string;
  size?: string;
}

export interface Notice {
  id: string;
  title: string;
  category: NoticeCategory;
  author: string;
  date: string;
  views: number;
  contentHtml?: string;
  contentText?: string;
  attachments?: NoticeAttachment[];
  url: string;
  isPinned?: boolean;
}

export type RestaurantType = '글빌 식당' | '스플 식당' | '경영 식당' | '학생식당' | '교직원식당' | '기숙사식당';
export type MealType = '조식' | '중식' | '석식' | '상시';

export interface CafeteriaMenu {
  id: string;
  date?: string; // YYYY-MM-DD
  restaurant: RestaurantType;
  category: string; // e.g. '찌개/밥', '돈까스/덮밥/비빔밥', '분식', '사이드', '음료', '겨울철 별미'
  name: string; // 개별 메뉴명 (e.g. '순두부찌개(공기밥)')
  mealType?: MealType;
  cornerName?: string;
  menuItems?: string[];
  price?: string;
  calories?: string;
  rating: number; // 평균 평점 (0.0 ~ 5.0)
  reviewCount: number;
}

export interface MealReview {
  id: string;
  menuId: string;
  restaurant: RestaurantType;
  menuName?: string;
  nickname?: string;
  date: string;
  studentEmailMasked: string; // e.g. '이승민 (2023****)' or 'ds***@dongseo.ac.kr'
  rating: number;
  comment: string;
  photoUrl?: string;
  createdAt: string;
  reported?: boolean;
  reportReason?: string;
}

export interface AcademicSchedule {
  id: string;
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  category: '수강/성적' | '등록/장학' | '시험' | '휴학/복학' | '행사';
  isImportant?: boolean;
  dDay?: number;
}
