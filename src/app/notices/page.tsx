'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import NoticeCard from '@/components/NoticeCard';
import { Notice, NoticeCategory } from '@/types';
import { Search, X, Loader2, Megaphone, Bell, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { getKeywordAlerts } from '@/lib/keyword-alerts';

const CATEGORIES: NoticeCategory[] = ['전체', '학사', '모집', '장학', '취업', '행사'];
const ITEMS_PER_PAGE = 20;

export default function NoticesPage() {
  const [selectedCategory, setSelectedCategory] = useState<NoticeCategory>('전체');
  const [searchQuery, setSearchQuery] = useState('');
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  // 검색창 입력값과 실제로 조회한 검색어를 분리 (입력 중에는 목록이 바뀌지 않도록)
  const [appliedQuery, setAppliedQuery] = useState('');

  // 키워드 알림 상태
  const [keywords, setKeywords] = useState<string[]>([]);

  useEffect(() => {
    setKeywords(getKeywordAlerts());
    const handleKeywordsUpdate = () => setKeywords(getKeywordAlerts());
    window.addEventListener('dsu_keywords_updated', handleKeywordsUpdate);
    return () => window.removeEventListener('dsu_keywords_updated', handleKeywordsUpdate);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const params = new URLSearchParams({ page: String(currentPage), pageSize: String(ITEMS_PER_PAGE) });
        if (selectedCategory !== '전체') params.set('category', selectedCategory);
        if (appliedQuery.trim()) params.set('q', appliedQuery.trim());

        const res = await fetch(`/api/notices?${params.toString()}`, { signal: controller.signal });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || '공지사항을 불러오지 못했습니다.');
        setNotices(data.data);
        setTotalCount(data.total);
        setTotalPages(data.totalPages);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        console.error(err);
        setNotices([]);
        setLoadError((err as Error).message || '공지사항을 불러오지 못했습니다.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [selectedCategory, appliedQuery, currentPage]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    setAppliedQuery(searchQuery.trim());
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setCurrentPage(1);
    setAppliedQuery('');
  };

  const handleCategoryChange = (cat: NoticeCategory) => {
    setSelectedCategory(cat);
    setCurrentPage(1);
  };

  // 페이지 나누기는 서버(DB range 조회)에서 처리
  const currentNotices = notices;

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getPageNumbers = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 3) {
      return [1, 2, 3, 4, 5];
    }
    if (currentPage >= totalPages - 2) {
      return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2];
  };

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col">
      <Header title="공지사항" />

      {/* 상단 검색 및 필터 바 */}
      <div className="bg-white border-b border-slate-100 px-4 pt-3 pb-2 sticky top-[53px] z-30">
        <form onSubmit={handleSearchSubmit} className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="공지 제목, 부서, 키워드 검색"
            className="w-full bg-slate-100 text-slate-900 text-sm pl-10 pr-9 py-2.5 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-dongseo-700 transition"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          {searchQuery && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="p-1 text-slate-400 hover:text-slate-600 absolute right-2.5 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </form>

        {/* 관심 키워드 알림 바 */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 mt-2 pt-1 border-t border-slate-50 text-xs">
          <Link
            href="/my/notifications"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-200/80 font-bold hover:bg-amber-100 transition shrink-0"
          >
            <Bell className="w-3 h-3 text-amber-600 fill-amber-500" />
            <span>키워드 알림</span>
            <span className="ml-0.5 text-[10px] bg-amber-200/90 text-amber-900 px-1.5 py-0.2 rounded-full font-extrabold">
              {keywords.length}
            </span>
          </Link>

          {keywords.map((kw) => (
            <span
              key={kw}
              onClick={() => {
                setSearchQuery(kw);
                setAppliedQuery(kw);
                setCurrentPage(1);
              }}
              className="cursor-pointer text-[11px] font-semibold px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md shrink-0 transition"
              title="클릭 시 해당 키워드 검색"
            >
              #{kw}
            </span>
          ))}
        </div>

        {/* 카테고리 탭 스크롤 */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-2 mt-1">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 ${
                  isSelected
                    ? 'bg-dongseo-700 text-white shadow-sm shadow-dongseo-700/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* 공지 목록 */}
      <div className="p-4 flex-1">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-3 px-1">
          <span>
            총 <strong className="text-dongseo-700">{totalCount}</strong>건의 공지
          </span>
          {appliedQuery && <span>&apos;{appliedQuery}&apos; 검색 결과</span>}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-7 h-7 animate-spin text-dongseo-700 mb-2" />
            <span className="text-xs">동서대 공지사항을 불러오는 중...</span>
          </div>
        ) : loadError ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 p-6">
            <Megaphone className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">{loadError}</p>
            <p className="text-xs text-slate-400 mt-1">잠시 후 다시 시도해 주세요.</p>
          </div>
        ) : notices.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 p-6">
            <Megaphone className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">해당하는 공지사항이 없습니다.</p>
            <p className="text-xs text-slate-400 mt-1">다른 검색어나 카테고리를 선택해보세요.</p>
          </div>
        ) : (
          <>
            <div className="space-y-2.5">
              {currentNotices.map((notice) => (
                <NoticeCard key={notice.id} notice={notice} />
              ))}
            </div>

            {/* 페이지네이션 컨트롤 (20개 단위 분할) */}
            {totalPages > 1 && (
              <nav aria-label="공지사항 페이지 네비게이션" className="flex items-center justify-center gap-1.5 mt-6 mb-2">
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-2 rounded-xl text-slate-500 hover:text-dongseo-700 hover:bg-slate-100 disabled:opacity-25 disabled:pointer-events-none transition"
                  aria-label="이전 페이지"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {getPageNumbers().map((page) => {
                  const isActive = currentPage === page;
                  return (
                    <button
                      key={page}
                      type="button"
                      onClick={() => handlePageChange(page)}
                      className={`min-w-[36px] h-9 px-2 rounded-xl text-xs font-bold transition-all duration-150 ${
                        isActive
                          ? 'bg-dongseo-700 text-white shadow-sm shadow-dongseo-700/20'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-xl text-slate-500 hover:text-dongseo-700 hover:bg-slate-100 disabled:opacity-25 disabled:pointer-events-none transition"
                  aria-label="다음 페이지"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </nav>
            )}
          </>
        )}
      </div>

    </main>
  );
}
