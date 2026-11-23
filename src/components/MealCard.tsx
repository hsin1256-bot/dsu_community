'use client';

import React from 'react';
import { CafeteriaMenu } from '@/types';
import { Star, MessageSquareText } from 'lucide-react';

interface MealCardProps {
  menu: CafeteriaMenu;
  onOpenReview: (menu: CafeteriaMenu) => void;
}

export default function MealCard({ menu, onOpenReview }: MealCardProps) {
  const hasMultipleItems = Boolean(menu.menuItems && menu.menuItems.length > 1);

  // 구성품이 여러 개인 식단표 (글빌 식당 등): 주 메뉴는 진하게, 나머지 메뉴도 같은 크기로 세로 나열
  if (hasMultipleItems && menu.menuItems) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:shadow-md hover:border-dongseo-200 transition-all duration-200">
        {/* 상단: 날짜/카테고리 + 식사 구분 + 별점 */}
        <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-dongseo-50 text-dongseo-700 border border-dongseo-200">
              {menu.category}
            </span>
            {menu.cornerName && menu.cornerName !== menu.category && (
              <span className="text-xs font-extrabold text-slate-800">
                {menu.cornerName}
              </span>
            )}
          </div>

          {menu.reviewCount > 0 ? (
            <span className="inline-flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 text-xs">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="font-extrabold text-amber-900">
                {menu.rating.toFixed(1)}
              </span>
              <span className="text-slate-400 text-[11px]">({menu.reviewCount})</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
              <Star className="w-3 h-3 text-slate-300" />
              <span>리뷰 없음</span>
            </span>
          )}
        </div>

        {/* 메뉴 세로 나열: 주 메뉴 진하게 + 나머지 메뉴도 동일한 크기(text-sm)로 아래로 나열 */}
        <ul className="space-y-1.5 bg-slate-50/70 p-3 rounded-xl border border-slate-100 mb-3">
          {menu.menuItems.map((item, idx) => (
            <li key={idx} className="flex items-center gap-2 text-sm leading-snug">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  idx === 0 ? 'bg-dongseo-700' : 'bg-slate-300'
                }`}
              />
              <span
                className={
                  idx === 0
                    ? 'font-extrabold text-slate-900'
                    : 'font-medium text-slate-700'
                }
              >
                {item}
              </span>
            </li>
          ))}
        </ul>

        {/* 하단: 가격 + 리뷰확인 버튼 */}
        <div className="flex items-center justify-between gap-2 pt-1">
          {menu.price ? (
            <span className="text-xs font-extrabold text-dongseo-700">
              {menu.price}
            </span>
          ) : (
            <span />
          )}

          <button
            onClick={() => onOpenReview(menu)}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dongseo-700 hover:bg-dongseo-800 text-white font-bold transition shadow-xs active:scale-95 text-xs"
          >
            <MessageSquareText className="w-3.5 h-3.5" />
            <span>리뷰확인</span>
          </button>
        </div>
      </div>
    );
  }

  // 개별 단품 메뉴 카드 (스플 식당, 경영 식당 등)
  return (
    <div className="bg-white rounded-2xl border border-slate-200 px-3.5 py-3 shadow-xs hover:shadow-md hover:border-dongseo-200 transition-all duration-200">
      <div className="flex items-center justify-between gap-3">
        {/* 좌측: 카테고리 배지 + 메뉴명 + 가격 */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-dongseo-50 text-dongseo-700 border border-dongseo-200 shrink-0">
              {menu.category}
            </span>
            <h4 className="text-sm font-extrabold text-slate-900 tracking-tight truncate">
              {menu.name}
            </h4>
          </div>

          {/* 가격 & 별점 요약 */}
          <div className="flex items-center gap-2.5 mt-1.5 text-xs">
            {menu.price && (
              <span className="font-extrabold text-dongseo-700">{menu.price}</span>
            )}

            <span className="text-slate-300">|</span>

            {menu.reviewCount > 0 ? (
              <span className="inline-flex items-center gap-1 text-xs">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span className="font-extrabold text-slate-800">
                  {menu.rating.toFixed(1)}
                </span>
                <span className="text-slate-400 text-[11px]">({menu.reviewCount})</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                <Star className="w-3 h-3 text-slate-300" />
                <span>리뷰 없음</span>
              </span>
            )}
          </div>
        </div>

        {/* 우측: 메뉴별 [리뷰확인] 버튼 */}
        <button
          onClick={() => onOpenReview(menu)}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-dongseo-700 hover:bg-dongseo-800 text-white font-bold transition shadow-xs active:scale-95 text-xs"
        >
          <MessageSquareText className="w-3.5 h-3.5" />
          <span>리뷰확인</span>
        </button>
      </div>
    </div>
  );
}
