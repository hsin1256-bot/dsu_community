'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import MealCard from '@/components/MealCard';
import ReviewModal from '@/components/ReviewModal';
import { CafeteriaMenu, RestaurantType, MealReview } from '@/types';
import {
  UtensilsCrossed,
  MessageSquare,
  Star,
  PlusCircle,
  Loader2,
  ChevronRight,
  Search,
  X,
} from 'lucide-react';

// Leaflet 지도를 SSR 없이 클라이언트 전용으로 부드럽게 로드
const CafeteriaMap = dynamic(() => import('@/components/CafeteriaMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-72 bg-white rounded-3xl border border-slate-200 flex flex-col items-center justify-center text-slate-400 gap-2.5 shadow-sm">
      <Loader2 className="w-6 h-6 animate-spin text-dongseo-700" />
      <span className="text-xs font-bold text-slate-600">동서대 실제 캠퍼스 지도 로딩 중...</span>
    </div>
  ),
});

// 동서대학교 3대 식당
const RESTAURANTS: { id: RestaurantType; label: string; badge?: string }[] = [
  { id: '글빌 식당', label: '글빌 식당' },
  { id: '스플 식당', label: '스플 식당' },
  { id: '경영 식당', label: '경영 식당' },
];

export default function CafeteriaPage() {
  const [selectedRestaurant, setSelectedRestaurant] = useState<RestaurantType>('글빌 식당');
  const [menus, setMenus] = useState<CafeteriaMenu[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [reviews, setReviews] = useState<MealReview[]>([]);
  const [loading, setLoading] = useState(true);

  // 리뷰 확인/작성 모달 상태
  const [modalOpen, setModalOpen] = useState(false);
  const [targetMenu, setTargetMenu] = useState<CafeteriaMenu | null>(null);

  // 카테고리 탭 가로 스크롤 중앙 정렬용 ref
  const categoryScrollRef = useRef<HTMLDivElement | null>(null);
  const categoryButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const centerCategoryTab = (cat: string) => {
    const container = categoryScrollRef.current;
    const btn = categoryButtonRefs.current[cat];
    if (!container || !btn) return;
    const targetLeft =
      btn.offsetLeft - container.clientWidth / 2 + btn.clientWidth / 2;
    container.scrollTo({
      left: Math.max(0, targetLeft),
      behavior: 'smooth',
    });
  };

  const fetchMenusAndReviews = async (restaurant: RestaurantType, preserveCategory = false) => {
    setLoading(true);
    try {
      const [menuRes, reviewRes] = await Promise.all([
        fetch(`/api/cafeteria?restaurant=${encodeURIComponent(restaurant)}`),
        fetch(`/api/cafeteria/reviews?restaurant=${encodeURIComponent(restaurant)}`),
      ]);

      const menuData = await menuRes.json();
      const reviewData = await reviewRes.json();

      if (menuData.success) {
        const loadedCategories: string[] = menuData.categories || [];
        setMenus(menuData.data);
        setCategories(loadedCategories);

        if (!preserveCategory) {
          // 글빌 식당은 '전체' 탭을 제거하고 오늘 날짜(없으면 첫 번째 요일)를 자동 선택
          if (restaurant === '글빌 식당' && loadedCategories.length > 0) {
            const now = new Date();
            const todayPrefix = `${now.getMonth() + 1}월 ${now.getDate()}일`;
            const todayMatch = loadedCategories.find((c) => c.startsWith(todayPrefix));
            setSelectedCategory(todayMatch || loadedCategories[0]);
          } else {
            setSelectedCategory('전체');
          }
        }
      }
      if (reviewData.success) {
        setReviews(reviewData.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    categoryButtonRefs.current = {};
    setSearchQuery('');
    fetchMenusAndReviews(selectedRestaurant);
  }, [selectedRestaurant]);

  // 선택된 카테고리가 바뀔 때마다 해당 탭을 가로 스크롤 중앙으로 부드럽게 이동
  useEffect(() => {
    if (!selectedCategory) return;
    const frameId = requestAnimationFrame(() => {
      centerCategoryTab(selectedCategory);
    });
    return () => cancelAnimationFrame(frameId);
  }, [selectedCategory, categories]);

  const handleOpenReviewModal = (menu?: CafeteriaMenu) => {
    setTargetMenu(menu || null);
    setModalOpen(true);
  };

  // 카테고리별 메뉴 개수 집계
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    menus.forEach((m) => {
      counts[m.category] = (counts[m.category] || 0) + 1;
    });
    return counts;
  }, [menus]);

  // 카테고리 + 검색어 필터링된 메뉴 목록
  const filteredMenus = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return menus.filter((m) => {
      const matchesCat = selectedCategory === '전체' || m.category === selectedCategory;
      const matchesQuery =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        (m.menuItems && m.menuItems.some((item) => item.toLowerCase().includes(q)));
      return matchesCat && matchesQuery;
    });
  }, [menus, selectedCategory, searchQuery]);

  // 큰 틀(카테고리) 단위로 그룹화
  const groupedMenus = useMemo(() => {
    const order = selectedCategory === '전체' ? categories : [selectedCategory];
    return order
      .map((cat) => ({
        category: cat,
        items: filteredMenus.filter((m) => m.category === cat),
      }))
      .filter((group) => group.items.length > 0);
  }, [categories, selectedCategory, filteredMenus]);

  // 평균 평점 계산 (전체 및 최근 1개월 / 30일)
  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((acc, cur) => acc + cur.rating, 0) / reviews.length).toFixed(1)
      : '0.0';

  const monthlyReviews = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return reviews.filter((r) => {
      const ts = Date.parse(r.createdAt || r.date);
      return Number.isNaN(ts) || ts >= cutoff;
    });
  }, [reviews]);

  const monthlyAvgRating =
    monthlyReviews.length > 0
      ? (
          monthlyReviews.reduce((acc, cur) => acc + cur.rating, 0) /
          monthlyReviews.length
        ).toFixed(1)
      : '0.0';

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col pb-24 select-none">
      {/* ===================== 상단 헤더: (로고) 학식 + 북마크 + 알림 ===================== */}
      <Header title="학식" />

      {/* 학식 페이지 본문 (스크롤 기능 포함, 화이트&버건디) */}
      <div className="p-4 space-y-4 max-w-[480px] mx-auto w-full">
        {/* ===================== 1. 각 식당 별 지도 이미지 (식당 클릭 시 이동) ===================== */}
        <section>
          <CafeteriaMap
            selectedRestaurant={selectedRestaurant}
            onSelectRestaurant={(rest) => {
              setSelectedRestaurant(rest);
              document.getElementById('restaurant-menu-section')?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              });
            }}
          />
        </section>

        {/* ===================== 2. 식당 선택 탭 & 카테고리 큰 틀 필터 ===================== */}
        <section className="sticky top-[53px] z-30 pt-1 pb-2 bg-slate-50/95 backdrop-blur-xs space-y-2.5">
          {/* 3대 식당 탭 */}
          <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-xs gap-1">
            {RESTAURANTS.map((rest) => {
              const isSelected = selectedRestaurant === rest.id;
              return (
                <button
                  key={rest.id}
                  onClick={() => setSelectedRestaurant(rest.id)}
                  className={`flex-1 py-2.5 px-2 text-xs font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-1 ${
                    isSelected
                      ? 'bg-dongseo-700 text-white shadow-sm shadow-dongseo-700/30'
                      : 'text-slate-600 hover:text-dongseo-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{rest.label}</span>
                  {rest.badge && (
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded font-normal ${
                        isSelected
                          ? 'bg-dongseo-900/60 text-white'
                          : 'bg-dongseo-50 text-dongseo-700'
                      }`}
                    >
                      {rest.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* 카테고리 큰 틀 필터 (선택 시 해당 탭이 가로 중앙으로 부드럽게 이동) */}
          {categories.length > 0 && (
            <div
              ref={categoryScrollRef}
              className="relative flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar"
            >
              {selectedRestaurant !== '글빌 식당' && (
                <button
                  ref={(el) => {
                    categoryButtonRefs.current['전체'] = el;
                  }}
                  onClick={() => {
                    setSelectedCategory('전체');
                    centerCategoryTab('전체');
                  }}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition border ${
                    selectedCategory === '전체'
                      ? 'bg-dongseo-700 text-white border-dongseo-700 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-dongseo-300 hover:text-dongseo-700'
                  }`}
                >
                  전체 <span className="opacity-75 text-[10px] ml-0.5">{menus.length}</span>
                </button>
              )}

              {categories.map((cat) => {
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    ref={(el) => {
                      categoryButtonRefs.current[cat] = el;
                    }}
                    onClick={() => {
                      setSelectedCategory(cat);
                      centerCategoryTab(cat);
                    }}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition border ${
                      isSelected
                        ? 'bg-dongseo-700 text-white border-dongseo-700 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-dongseo-300 hover:text-dongseo-700'
                    }`}
                  >
                    {cat}{' '}
                    <span className="opacity-75 text-[10px] ml-0.5">
                      {categoryCounts[cat] || 0}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 메뉴 검색 & 리뷰 작성 퀵 액션 */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center bg-white border border-slate-200 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-dongseo-700 focus-within:border-transparent">
              <Search className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`${selectedRestaurant} 메뉴 검색...`}
                className="w-full text-xs bg-transparent focus:outline-none text-slate-800 placeholder-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-slate-400 hover:text-slate-600 ml-1"
                  aria-label="검색어 지우기"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              onClick={() => handleOpenReviewModal()}
              className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl bg-dongseo-50 hover:bg-dongseo-100 text-dongseo-700 border border-dongseo-200 font-extrabold text-xs transition"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>리뷰 작성</span>
            </button>
          </div>
        </section>

        {/* ===================== 2-1. 글빌 식당 최근 한 달(30일) 평점 요약 카드 ===================== */}
        {selectedRestaurant === '글빌 식당' && !loading && (
          <section className="bg-white rounded-2xl border border-dongseo-100 p-3.5 shadow-xs flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-dongseo-50 text-dongseo-700 border border-dongseo-200">
                  최근 한 달(30일)
                </span>
                <span className="text-xs font-extrabold text-slate-900">
                  글빌 식당 평균 평점
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {monthlyReviews.length > 0
                  ? `최근 한 달간 등록된 리뷰 ${monthlyReviews.length}개 기준`
                  : '최근 한 달간 등록된 리뷰가 아직 없습니다'}
              </p>
            </div>

            <div className="flex items-center gap-1.5 bg-amber-50 px-3 py-2 rounded-xl border border-amber-200 shrink-0">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span className="text-base font-black text-amber-900">
                {monthlyReviews.length > 0 ? monthlyAvgRating : '-'}
              </span>
              <span className="text-[11px] text-amber-700/70 font-semibold">/ 5.0</span>
            </div>
          </section>
        )}

        {/* ===================== 3. 카테고리별 메뉴 섹션 (중식/석식 분류 없이 메뉴별 리뷰 지원) ===================== */}
        <section id="restaurant-menu-section" className="space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-200">
              <Loader2 className="w-7 h-7 animate-spin text-dongseo-700 mb-2" />
              <span className="text-xs font-medium">메뉴 정보를 불러오는 중...</span>
            </div>
          ) : groupedMenus.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl text-center border border-slate-200">
              <UtensilsCrossed className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">조건에 맞는 메뉴가 없습니다.</p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-2 text-xs font-bold text-dongseo-700 underline"
                >
                  검색어 초기화
                </button>
              )}
            </div>
          ) : (
            groupedMenus.map((group) => (
              <div key={group.category} className="space-y-2.5">
                {/* 카테고리 큰 틀 헤더 */}
                <div className="flex items-center justify-between px-1 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-dongseo-700" />
                    <h3 className="text-sm font-extrabold text-slate-900">
                      {group.category}
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-400 font-semibold">
                    {group.items.length}개 메뉴
                  </span>
                </div>

                {/* 개별 메뉴 카드 리스트 */}
                <div className="space-y-2">
                  {group.items.map((menu) => (
                    <MealCard
                      key={menu.id}
                      menu={menu}
                      onOpenReview={(m) => handleOpenReviewModal(m)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </section>

        {/* ===================== 4. 학우들의 실시간 리뷰 피드 ===================== */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-dongseo-700" />
              <h3 className="text-sm font-extrabold text-slate-900">
                {selectedRestaurant} 최근 리뷰
              </h3>
            </div>

            <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 text-xs">
              {selectedRestaurant === '글빌 식당' && (
                <span className="text-[10px] font-bold text-amber-800 mr-0.5">최근 1개월</span>
              )}
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="font-black text-amber-900">
                {selectedRestaurant === '글빌 식당'
                  ? monthlyReviews.length > 0
                    ? monthlyAvgRating
                    : '-'
                  : reviews.length > 0
                    ? avgRating
                    : '-'}
              </span>
              <span className="text-slate-400 text-[11px]">
                ({selectedRestaurant === '글빌 식당' ? monthlyReviews.length : reviews.length})
              </span>
            </div>
          </div>

          {reviews.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              아직 작성된 리뷰가 없습니다. 첫 한줄평을 남겨보세요!
            </div>
          ) : (
            <div className="space-y-2.5">
              {reviews.slice(0, 3).map((rev) => {
                const matchedMenu =
                  selectedRestaurant === '글빌 식당'
                    ? menus.find((m) => m.id === rev.menuId || m.name === rev.menuName)
                    : undefined;
                const reviewMenuLabel =
                  selectedRestaurant === '글빌 식당'
                    ? matchedMenu
                      ? `${matchedMenu.category} ${matchedMenu.cornerName || ''} · ${matchedMenu.menuItems?.[0] || matchedMenu.name}`.replace(/\s+/g, ' ').trim()
                      : rev.menuName
                        ? `${rev.date} · ${rev.menuName}`
                        : ''
                    : rev.menuName || '';

                return (
                  <div
                    key={rev.id}
                    className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/80 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-extrabold text-slate-900">
                          {rev.nickname || rev.studentEmailMasked}
                        </span>
                        {reviewMenuLabel && (
                          <span className="text-[10px] text-dongseo-700 bg-dongseo-50 px-1.5 py-0.5 rounded border border-dongseo-100 font-semibold">
                            {reviewMenuLabel}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center text-amber-400 shrink-0">
                        {Array.from({ length: rev.rating }).map((_, i) => (
                          <Star key={i} className="w-3 h-3 fill-amber-400" />
                        ))}
                      </div>
                    </div>
                    <p className="text-slate-700 font-medium leading-relaxed">{rev.comment}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* 전체 리뷰 확인 버튼 */}
          <button
            onClick={() => handleOpenReviewModal()}
            className="w-full py-2.5 mt-1 bg-slate-50 hover:bg-dongseo-50 text-dongseo-700 border border-slate-200 hover:border-dongseo-200 rounded-xl font-bold transition text-xs flex items-center justify-center gap-1.5"
          >
            <span>{selectedRestaurant} 전체 리뷰 확인 및 작성하기</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </section>
      </div>

      {/* ===================== 와이어프레임 지정 [리뷰 확인] 모달 ===================== */}
      <ReviewModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        restaurant={selectedRestaurant}
        menu={targetMenu}
        availableMenus={menus}
        reviews={reviews}
        onSuccess={() => fetchMenusAndReviews(selectedRestaurant, true)}
      />
    </main>
  );
}
