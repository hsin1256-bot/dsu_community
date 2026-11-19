'use client';

import React, { useState, useEffect } from 'react';
import {
  Star,
  X,
  CheckCircle2,
  AlertCircle,
  Camera,
  Flag,
  Upload,
  Image as ImageIcon,
  Trash2,
  Utensils,
  User,
} from 'lucide-react';
import { RestaurantType, CafeteriaMenu, MealReview } from '@/types';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurant: RestaurantType;
  menu?: CafeteriaMenu | null;
  availableMenus: CafeteriaMenu[];
  reviews: MealReview[];
  onSuccess?: () => void;
}

export default function ReviewModal({
  isOpen,
  onClose,
  restaurant,
  menu,
  availableMenus,
  reviews,
  onSuccess,
}: ReviewModalProps) {
  // 작성 폼 상태
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [nickname, setNickname] = useState('');
  const [selectedMenuId, setSelectedMenuId] = useState<string>('');
  const [comment, setComment] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 신고하기 모달 상태
  const [reportTargetReview, setReportTargetReview] = useState<MealReview | null>(null);
  const [reportReason, setReportReason] = useState('부적절한 리뷰 확인 (욕설/비방/음란)');
  const [reportedIds, setReportedIds] = useState<Record<string, boolean>>({});

  // 프리셋 사진 선택 팝오버
  const [showPhotoPresets, setShowPhotoPresets] = useState(false);

  // 모달이 열리거나 선택 메뉴가 바뀔 때 폼 대상 메뉴 동기화
  useEffect(() => {
    if (isOpen) {
      if (menu) {
        setSelectedMenuId(menu.id);
      } else if (availableMenus.length > 0) {
        setSelectedMenuId(availableMenus[0].id);
      } else {
        setSelectedMenuId('general');
      }
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [isOpen, menu, availableMenus]);

  const PHOTO_PRESETS = [
    {
      label: '돈까스 정식',
      url: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=600&auto=format&fit=crop&q=80',
    },
    {
      label: '얼큰 찌개/국',
      url: 'https://images.unsplash.com/photo-1547496502-affa22d38842?w=600&auto=format&fit=crop&q=80',
    },
    {
      label: '제육/덮밥',
      url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&auto=format&fit=crop&q=80',
    },
    {
      label: '라면/분식',
      url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&auto=format&fit=crop&q=80',
    },
    {
      label: '비빔밥/정식',
      url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80',
    },
  ];

  if (!isOpen) return null;

  const activeMenuObj =
    menu || availableMenus.find((m) => m.id === selectedMenuId) || null;

  const displayMenuName = menu ? menu.name : `${restaurant} 전체 메뉴`;

  // 특정 메뉴가 지정되었으면 해당 메뉴의 리뷰만 필터링 (중복 카테고리 동일 메뉴명 포함)
  const filteredReviews = menu
    ? reviews.filter((r) => r.menuId === menu.id || r.menuName === menu.name)
    : reviews;

  const avgRating =
    filteredReviews.length > 0
      ? (
          filteredReviews.reduce((acc, cur) => acc + cur.rating, 0) /
          filteredReviews.length
        ).toFixed(1)
      : '0.0';

  // 사진 업로드 핸들러 (로컬 파일 -> Data URL)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoUrl(reader.result as string);
        setShowPhotoPresets(false);
      };
      reader.readAsDataURL(file);
    }
  };

  // 리뷰 제출 핸들러
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!comment.trim()) {
      setErrorMsg('한줄 리뷰 내용을 작성해주세요.');
      return;
    }

    const submitMenu =
      menu || availableMenus.find((m) => m.id === selectedMenuId) || availableMenus[0];

    setLoading(true);

    try {
      const res = await fetch('/api/cafeteria/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant,
          menuId: submitMenu?.id || 'general',
          menuName: submitMenu?.name || displayMenuName,
          nickname: nickname.trim() || '동서대 익명 학우',
          rating,
          comment: comment.trim(),
          photoUrl: photoUrl || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '리뷰 저장에 실패했습니다.');
      }

      setSuccessMsg('리뷰가 데이터베이스에 저장되었습니다!');
      onSuccess?.();
      setTimeout(() => {
        setComment('');
        setPhotoUrl('');
        setSuccessMsg('');
      }, 900);
    } catch (err: any) {
      setErrorMsg(err.message || '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 신고 제출 핸들러
  const handleReportSubmit = async () => {
    if (!reportTargetReview) return;
    try {
      await fetch('/api/cafeteria/reviews', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewId: reportTargetReview.id,
          reason: reportReason,
        }),
      });
      setReportedIds((prev) => ({ ...prev, [reportTargetReview.id]: true }));
      setReportTargetReview(null);
      alert('신고가 접수되었습니다. 관리자 확인 후 즉시 조치됩니다.');
    } catch {
      alert('신고 접수 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white w-full max-w-md max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* ===================== 상단 헤더: 리뷰 확인 ===================== */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-dongseo-700" />
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">리뷰 확인</h2>
            <span className="text-xs font-bold text-dongseo-700 bg-dongseo-50 px-2 py-0.5 rounded-full border border-dongseo-200">
              {restaurant}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-800 rounded-full hover:bg-slate-100 transition"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 스크롤 가능한 본문 영역 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-xs">
          {/* ===================== 메뉴 이름 & 리뷰 별점 ===================== */}
          <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-dongseo-700 uppercase tracking-wider">
                  {menu ? menu.category : '전체 메뉴'}
                </span>
                {menu?.price && (
                  <span className="text-[11px] font-extrabold text-slate-600">
                    · {menu.price}
                  </span>
                )}
              </div>
              <h3 className="text-sm font-extrabold text-slate-900 mt-0.5 truncate">
                {displayMenuName}
              </h3>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10px] font-bold text-slate-500 block">리뷰 별점</span>
              <div className="flex items-center gap-1 mt-0.5 justify-end">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span className="text-base font-black text-slate-900">
                  {filteredReviews.length > 0 ? avgRating : '-'}
                </span>
                <span className="text-[11px] text-slate-400">
                  ({filteredReviews.length}개)
                </span>
              </div>
            </div>
          </div>

          {/* ===================== 구분선 ===================== */}
          <div className="border-t border-dashed border-slate-200" />

          {/* ===================== 한줄 리뷰 (사진) 목록 ===================== */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-slate-600 font-bold text-xs">
              <span>{menu ? `'${menu.name}' 리뷰` : '학우들의 한줄 리뷰'}</span>
              <span className="text-[11px] text-dongseo-700">총 {filteredReviews.length}개</span>
            </div>

            {filteredReviews.length === 0 ? (
              <div className="text-center py-7 text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                아직 등록된 리뷰가 없습니다.
                <br />
                아래에서 이 메뉴의 첫 리뷰를 남겨보세요!
              </div>
            ) : (
              filteredReviews.map((rev) => {
                const isReported = reportedIds[rev.id] || rev.reported;
                const matchedMenu =
                  restaurant === '글빌 식당'
                    ? availableMenus.find((m) => m.id === rev.menuId || m.name === rev.menuName)
                    : undefined;
                const reviewMenuLabel =
                  restaurant === '글빌 식당'
                    ? matchedMenu
                      ? `${matchedMenu.category} ${matchedMenu.cornerName || ''} · ${matchedMenu.menuItems?.[0] || matchedMenu.name}`.replace(/\s+/g, ' ').trim()
                      : rev.menuName
                        ? `${rev.date} · ${rev.menuName}`
                        : ''
                    : rev.menuName || '';

                return (
                  <div
                    key={rev.id}
                    className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2 hover:border-dongseo-200 transition"
                  >
                    {/* 상단: 닉네임 + 메뉴 + 별점 */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-extrabold text-slate-900">
                          {rev.nickname || rev.studentEmailMasked}
                        </span>
                        {reviewMenuLabel && (
                          <span className="text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-semibold">
                            {reviewMenuLabel}
                          </span>
                        )}
                        <span className="text-[9px] text-dongseo-700 bg-dongseo-50 px-1 py-0.5 rounded border border-dongseo-100 font-semibold">
                          인증
                        </span>
                      </div>

                      <div className="flex items-center gap-0.5 text-amber-400 shrink-0">
                        {Array.from({ length: rev.rating }).map((_, i) => (
                          <Star key={i} className="w-3 h-3 fill-amber-400" />
                        ))}
                      </div>
                    </div>

                    {/* 리뷰 본문 */}
                    <p className="text-xs text-slate-800 leading-relaxed font-medium">
                      {rev.comment}
                    </p>

                    {/* 사진 (선택 시 썸네일) */}
                    {rev.photoUrl && (
                      <div className="pt-1">
                        <img
                          src={rev.photoUrl}
                          alt="식단 인증 사진"
                          className="w-20 h-20 object-cover rounded-xl border border-slate-200 shadow-xs hover:opacity-90 cursor-pointer"
                          onClick={() => window.open(rev.photoUrl, '_blank')}
                        />
                      </div>
                    )}

                    {/* 하단: 일자 & 신고하기 버튼 */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px] text-slate-400">
                      <span>{rev.date || '2026-11-19'}</span>
                      {isReported ? (
                        <span className="text-red-500 font-medium">신고 접수됨</span>
                      ) : (
                        <button
                          onClick={() => setReportTargetReview(rev)}
                          className="inline-flex items-center gap-1 text-slate-400 hover:text-red-600 font-medium transition"
                        >
                          <Flag className="w-3 h-3" />
                          <span>신고하기</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ===================== 구분선 ===================== */}
          <div className="border-t-2 border-slate-200 my-2" />

          {/* ===================== 리뷰 작성 섹션 (+ 닉네임 - 메뉴 / 사진 추가 / 리뷰 / 확인) ===================== */}
          <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 space-y-3.5">
            <h4 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
              <span>리뷰 작성</span>
              {activeMenuObj && (
                <span className="text-[10px] text-dongseo-700 bg-dongseo-50 px-1.5 py-0.5 rounded border border-dongseo-200 font-bold">
                  {activeMenuObj.name}
                </span>
              )}
            </h4>

            {errorMsg && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-700">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              {/* 별점 선택 */}
              <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-700">별점 평가</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1 transition-transform hover:scale-110 active:scale-95"
                    >
                      <Star
                        className={`w-5 h-5 ${
                          (hoverRating || rating) >= star
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-200 fill-slate-100'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="ml-1 font-extrabold text-slate-800 text-xs">{rating}점</span>
                </div>
              </div>

              {/* 1. + 닉네임 - 메뉴 */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-700">
                  닉네임 & 메뉴 선택
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center bg-white border border-slate-200 rounded-xl px-2.5 py-2 focus-within:ring-2 focus-within:ring-dongseo-700 focus-within:border-transparent">
                    <User className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
                    <input
                      type="text"
                      placeholder="닉네임 (ex: 이승민)"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      className="w-full text-xs bg-transparent focus:outline-none text-slate-800 placeholder-slate-400 font-medium"
                    />
                  </div>

                  <div className="flex items-center bg-white border border-slate-200 rounded-xl px-2.5 py-2 focus-within:ring-2 focus-within:ring-dongseo-700 focus-within:border-transparent">
                    <Utensils className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
                    {menu ? (
                      <span className="text-xs font-bold text-slate-800 truncate">
                        {menu.name}
                      </span>
                    ) : (
                      <select
                        value={selectedMenuId}
                        onChange={(e) => setSelectedMenuId(e.target.value)}
                        className="w-full text-xs bg-transparent focus:outline-none text-slate-800 font-medium cursor-pointer"
                      >
                        {availableMenus.map((m) => (
                          <option key={m.id} value={m.id}>
                            [{m.category}] {m.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </div>

              {/* 구분선 */}
              <div className="border-t border-slate-200/60" />

              {/* 2. 사진 추가 (선택) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <Camera className="w-3.5 h-3.5 text-dongseo-700" />
                    <span>사진 추가 (선택)</span>
                  </label>
                  {photoUrl && (
                    <button
                      type="button"
                      onClick={() => setPhotoUrl('')}
                      className="text-[11px] text-red-500 hover:text-red-700 flex items-center gap-0.5"
                    >
                      <Trash2 className="w-3 h-3" />
                      삭제
                    </button>
                  )}
                </div>

                {photoUrl ? (
                  <div className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-dongseo-700 shadow-sm">
                    <img src={photoUrl} alt="업로드 미리보기" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotoUrl('')}
                      className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white hover:bg-black"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <label className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white border border-dashed border-slate-300 hover:border-dongseo-400 rounded-xl cursor-pointer text-slate-600 hover:text-dongseo-700 transition">
                      <Upload className="w-3.5 h-3.5 text-dongseo-700" />
                      <span className="font-semibold text-xs">내 기기에서 사진 선택</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowPhotoPresets(!showPhotoPresets)}
                      className="py-2 px-3 bg-dongseo-50 hover:bg-dongseo-100 text-dongseo-700 border border-dongseo-200 rounded-xl font-bold transition text-xs flex items-center gap-1"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>샘플 사진</span>
                    </button>
                  </div>
                )}

                {showPhotoPresets && !photoUrl && (
                  <div className="p-2 bg-white rounded-xl border border-slate-200 grid grid-cols-5 gap-1.5 animate-in fade-in">
                    {PHOTO_PRESETS.map((preset, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setPhotoUrl(preset.url);
                          setShowPhotoPresets(false);
                        }}
                        className="flex flex-col items-center gap-1 group"
                      >
                        <img
                          src={preset.url}
                          alt={preset.label}
                          className="w-12 h-12 object-cover rounded-lg border border-slate-200 group-hover:border-dongseo-700 group-hover:scale-105 transition"
                        />
                        <span className="text-[9px] text-slate-600 group-hover:text-dongseo-700 truncate w-full text-center">
                          {preset.label}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 구분선 */}
              <div className="border-t border-slate-200/60" />

              {/* 3. 리뷰 (한줄평 입력창) */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700">리뷰</label>
                <textarea
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="학우들을 위한 솔직한 한줄 리뷰를 남겨주세요"
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-dongseo-700 focus:border-transparent font-medium resize-none"
                />
              </div>

              {/* 구분선 */}
              <div className="border-t border-slate-200/60" />

              {/* 4. [확인] 버튼 */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-dongseo-700 hover:bg-dongseo-800 active:scale-[0.99] text-white font-extrabold rounded-xl transition shadow-md shadow-dongseo-700/25 flex items-center justify-center gap-2 text-sm"
              >
                {loading ? '등록 중...' : '확인'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* ===================== [신고하기] 사유 선택 팝업 ===================== */}
      {reportTargetReview && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white w-full max-w-xs rounded-2xl shadow-xl p-5 border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900">
                <Flag className="w-4 h-4 text-red-600" />
                <span>신고하기</span>
              </div>
              <button
                onClick={() => setReportTargetReview(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-3">
              신고 사유를 선택해 주세요. 확인 후 조치됩니다:
            </p>

            <div className="space-y-2 mb-4">
              {[
                '부적절한 리뷰 확인 (욕설/비방/음란)',
                '허위 사실 기재 및 명예훼손',
                '광고 / 도배성 게시글',
                '기타 부적절한 사유',
              ].map((reason) => (
                <label
                  key={reason}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer text-xs transition ${
                    reportReason === reason
                      ? 'bg-dongseo-50 border-dongseo-300 text-dongseo-800 font-bold'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="reportReason"
                    checked={reportReason === reason}
                    onChange={() => setReportReason(reason)}
                    className="accent-dongseo-700"
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setReportTargetReview(null)}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                취소
              </button>
              <button
                onClick={handleReportSubmit}
                className="flex-1 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition shadow-xs"
              >
                신고 접수
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
