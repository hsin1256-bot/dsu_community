'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { Notice } from '@/types';
import {
  Download,
  Share2,
  Bookmark,
  Calendar,
  Eye,
  ExternalLink,
  FileText,
  Loader2,
  Check,
  Sparkles,
} from 'lucide-react';
import { isNoticeBookmarked, toggleNoticeBookmark } from '@/lib/bookmarks';

function renderInlineContent(content: string) {
  // 중복 링크 패턴 [URL](URL) -> URL 로 자동 정리
  const cleaned = content.replace(/\[(https?:\/\/[^\s\]]+)\]\(\1\)/g, '$1');

  // 마크다운 링크 [label](url), 볼드 **text**, 일반 URL 분리 정규식
  const regex = /(\[[^\]]+\]\(https?:\/\/[^\s\)]+\)|\*\*.*?\*\*|https?:\/\/[^\s<]+)/g;
  const parts = cleaned.split(regex);

  return parts.map((part, i) => {
    if (!part) return null;

    // 마크다운 링크: [label](url)
    const mdLinkMatch = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)$/);
    if (mdLinkMatch) {
      const [, label, url] = mdLinkMatch;
      return (
        <a
          key={i}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-dongseo-700 font-semibold underline underline-offset-2 hover:text-dongseo-800 break-all"
        >
          {label}
        </a>
      );
    }

    // 볼드 텍스트: **text**
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={i} className="font-bold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }

    // 일반 웹 링크: https://...
    if (/^https?:\/\/[^\s]+$/.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-dongseo-700 font-semibold underline underline-offset-2 hover:text-dongseo-800 break-all"
        >
          {part}
        </a>
      );
    }

    // 일반 텍스트
    return <span key={i}>{part}</span>;
  });
}

function formatSummaryText(text: string) {
  const lines = text.split('\n');
  return lines.map((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={idx} className="h-2" />;

    const isBullet = /^[\*•\-]\s+/.test(trimmed);
    const content = trimmed.replace(/^[\*•\-]\s+/, '');

    return (
      <div key={idx} className={`leading-relaxed ${isBullet ? 'flex items-start gap-2 my-1.5' : 'my-1'}`}>
        {isBullet && <span className="text-dongseo-700 font-bold mt-0.5 text-xs select-none">•</span>}
        <span className="flex-1 text-slate-800 text-sm">
          {renderInlineContent(content)}
        </span>
      </div>
    );
  });
}

export default function NoticeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookmarked, setBookmarked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  useEffect(() => {
    if (!id) return;
    setBookmarked(isNoticeBookmarked(id));

    const fetchDetail = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/notices/${encodeURIComponent(id)}`);
        const data = await res.json();
        if (data.success) {
          setNotice(data.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [id]);

  const handleBookmark = () => {
    if (!notice) return;
    const nextState = toggleNoticeBookmark(notice.id);
    setBookmarked(nextState);
  };

  const handleShare = async () => {
    if (navigator.share && notice) {
      try {
        await navigator.share({
          title: notice.title,
          text: `[동서대 공지사항] ${notice.title}`,
          url: window.location.href,
        });
      } catch {
        // 취소 등 무시
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex flex-col">
        <Header showBack title="공지사항 상세" />
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-dongseo-700 mb-2" />
          <span className="text-xs">공지사항 본문을 불러오는 중...</span>
        </div>
      </main>
    );
  }

  if (!notice) {
    return (
      <main className="min-h-screen bg-slate-50 flex flex-col">
        <Header showBack title="공지사항 상세" />
        <div className="p-6 text-center py-20">
          <p className="text-sm font-bold text-slate-700">해당 공지사항을 찾을 수 없습니다.</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-dongseo-700 text-white rounded-xl text-xs font-semibold"
          >
            목록으로 돌아가기
          </button>
        </div>
      </main>
    );
  }

  const hasSummary = notice.aiStatus === 'done' && !!notice.aiSummary && notice.aiSummary.length > 0;

  return (
    <main className="min-h-screen bg-white flex flex-col">
      <Header showBack title="공지사항 본문" />

      <article className="p-4 flex-1">
        {/* 공지 메타 정보 헤더 */}
        <div className="border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-dongseo-50 text-dongseo-700 border border-dongseo-200">
              {notice.category}
            </span>
          </div>

          <h1 className="text-lg font-extrabold text-slate-900 leading-snug tracking-tight">
            {notice.title}
          </h1>

          <div className="flex items-center justify-between text-xs text-slate-400 mt-3">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {notice.date}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                조회 {notice.views.toLocaleString()}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleBookmark}
                className={`p-1.5 rounded-lg border transition ${
                  bookmarked
                    ? 'border-dongseo-200 bg-dongseo-50 text-dongseo-700'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
                title="북마크"
              >
                <Bookmark className={`w-4 h-4 ${bookmarked ? 'fill-dongseo-700' : ''}`} />
              </button>
              <button
                onClick={handleShare}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition relative"
                title="공유하기"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* 첨부파일 다운로드 섹션 */}
        {notice.attachments && notice.attachments.length > 0 && (
          <div className="my-4 p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2">
              <FileText className="w-4 h-4 text-dongseo-700" />
              <span>첨부파일 ({notice.attachments.length})</span>
            </div>

            <div className="space-y-1.5">
              {notice.attachments.map((file, idx) => (
                <a
                  key={idx}
                  href={file.url}
                  target="_blank"
                  rel="noreferrer"
                  download
                  className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl hover:border-dongseo-300 transition text-xs group"
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span className="truncate font-medium text-slate-800 group-hover:text-dongseo-700">
                      {file.name}
                    </span>
                    {file.size && (
                      <span className="text-[11px] text-slate-400 shrink-0">({file.size})</span>
                    )}
                  </div>
                  <div className="p-1 rounded-lg bg-slate-100 group-hover:bg-dongseo-50 text-slate-600 group-hover:text-dongseo-700 shrink-0">
                    <Download className="w-3.5 h-3.5" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* 공지 본문: AI 요약(있을 때) + 원문 HTML(서버에서 sanitize-html 로 정제됨) */}
        <div className="py-4 space-y-4">
          {hasSummary && (
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 shadow-2xs">
              <div className="flex items-center gap-1.5 text-xs font-bold text-dongseo-700 mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI 요약</span>
              </div>
              <div className="space-y-1">{formatSummaryText(notice.aiSummary!.map((l) => `• ${l}`).join('\n'))}</div>
              {notice.aiKeywords && notice.aiKeywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-200/70">
                  {notice.aiKeywords.map((kw) => (
                    <span key={kw} className="text-[11px] font-semibold px-2 py-0.5 bg-white border border-slate-200 text-slate-600 rounded-md">
                      #{kw}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-slate-400 mt-3">AI가 만든 요약이라 틀릴 수 있어요. 일정·자격 요건은 원문을 꼭 확인해 주세요.</p>
            </div>
          )}

          {notice.contentHtml ? (
            hasSummary && !showOriginal ? (
              <button
                type="button"
                onClick={() => setShowOriginal(true)}
                className="w-full py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                원문 내용 펼치기
              </button>
            ) : (
              <div
                className="prose prose-sm max-w-none text-slate-800 leading-relaxed break-words [&_img]:rounded-xl [&_img]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:my-3 [&_th]:bg-slate-100 [&_th]:p-2 [&_td]:p-2 [&_td]:border [&_td]:border-slate-200 overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: notice.contentHtml }}
              />
            )
          ) : (
            !hasSummary && (
              <p className="text-sm text-slate-500 py-6 text-center">
                본문 상세 내용은 하단 학교 공식 홈페이지 원문 링크를 확인해 주세요.
              </p>
            )
          )}
        </div>

        {/* 원문 바로가기 버튼 */}
        <div className="mt-8 pt-6 border-t border-slate-100 pb-10">
          <p className="text-xs text-center text-slate-400 mb-2.5 font-medium">
            더 자세한 공지 내용이나 공식 원문 서식이 필요하신가요?
          </p>
          <a
            href={notice.url}
            target="_blank"
            rel="noreferrer"
            className="w-full py-3.5 px-4 bg-dongseo-50 hover:bg-dongseo-100 text-dongseo-700 font-bold rounded-2xl border border-dongseo-200/80 flex items-center justify-center gap-2 transition text-xs shadow-2xs group"
          >
            <span>동서대학교 공식 홈페이지 원문 바로가기</span>
            <ExternalLink className="w-4 h-4 text-dongseo-700 transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>
      </article>
    </main>
  );
}
