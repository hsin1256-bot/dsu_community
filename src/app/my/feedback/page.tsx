'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import { Bug, Lightbulb, AlertTriangle, HelpCircle, CheckCircle2, Loader2 } from 'lucide-react';

const CATEGORIES = [
  { value: 'bug', label: '버그 제보', icon: Bug, hint: '어떤 화면에서, 무엇을 했을 때, 어떻게 됐는지 적어 주세요.' },
  { value: 'feature', label: '기능 제안', icon: Lightbulb, hint: '있으면 좋겠는 기능과 이유를 적어 주세요.' },
  { value: 'data_error', label: '정보 오류', icon: AlertTriangle, hint: '틀린 공지·일정·메뉴와 올바른 내용을 적어 주세요.' },
  { value: 'other', label: '기타 문의', icon: HelpCircle, hint: '궁금한 점을 자유롭게 적어 주세요.' },
] as const;

const MESSAGE_MAX = 2000;

export default function FeedbackPage() {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['value']>('bug');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState(''); // 허니팟 (화면에 보이지 않음)
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState('');

  const current = CATEGORIES.find((c) => c.value === category)!;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (message.trim().length < 5) return setError('내용을 5자 이상 입력해 주세요.');
    setStatus('sending');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          message,
          contactEmail: email.trim() || undefined,
          pagePath: document.referrer ? new URL(document.referrer).pathname : undefined,
          website,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || '접수에 실패했습니다.');
      setStatus('done');
    } catch (err) {
      setError((err as Error).message);
      setStatus('idle');
    }
  };

  if (status === 'done') {
    return (
      <main className="min-h-screen bg-slate-50 flex flex-col">
        <Header showBack title="문의 및 피드백" />
        <div className="p-6 text-center py-20">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-800">소중한 의견 감사합니다!</p>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            {email ? '확인 후 입력하신 이메일로 답변드릴게요.' : '보내주신 내용은 앱 개선에 참고할게요.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setMessage('');
              setStatus('idle');
            }}
            className="mt-6 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
          >
            추가로 보내기
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col pb-6">
      <Header showBack title="문의 및 피드백" />

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        <section>
          <h2 className="text-xs font-bold text-slate-700 mb-2">어떤 내용인가요?</h2>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                aria-pressed={category === value}
                onClick={() => setCategory(value)}
                className={`flex items-center gap-2 p-3 rounded-2xl border text-xs font-bold transition ${
                  category === value ? 'bg-dongseo-50 border-dongseo-300 text-dongseo-700' : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <label htmlFor="fb-message" className="text-xs font-bold text-slate-700 mb-1 block">
            내용
          </label>
          <p className="text-[11px] text-slate-400 mb-2">{current.hint}</p>
          <textarea
            id="fb-message"
            rows={7}
            value={message}
            maxLength={MESSAGE_MAX}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full p-3 bg-white border border-slate-200 rounded-2xl text-sm text-slate-800 outline-none focus:ring-2 focus:ring-dongseo-700 resize-none"
          />
          <p className="text-right text-[11px] text-slate-400">
            {message.length} / {MESSAGE_MAX}
          </p>
        </section>

        <section>
          <label htmlFor="fb-email" className="text-xs font-bold text-slate-700 mb-1 block">
            답변받을 이메일 <span className="font-medium text-slate-400">(선택)</span>
          </label>
          <input
            id="fb-email"
            type="email"
            value={email}
            maxLength={100}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="답변이 필요할 때만 입력해 주세요"
            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-dongseo-700"
          />
          <p className="text-[11px] text-slate-400 mt-1">이메일은 답변 용도로만 사용해요. 자세한 내용은 개인정보처리방침을 확인해 주세요.</p>
        </section>

        {/* 허니팟: 사람에게는 보이지 않고, 자동 스팸 프로그램만 채우는 칸 */}
        <div aria-hidden="true" className="absolute -left-[9999px] w-px h-px overflow-hidden">
          <label htmlFor="fb-website">website</label>
          <input id="fb-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>

        {error && <p className="text-xs text-rose-600">{error}</p>}

        <button
          type="submit"
          disabled={status === 'sending'}
          className="w-full py-3 bg-dongseo-700 hover:bg-dongseo-800 disabled:opacity-60 text-white font-extrabold text-sm rounded-2xl flex items-center justify-center gap-2"
        >
          {status === 'sending' && <Loader2 className="w-4 h-4 animate-spin" />}
          보내기
        </button>
      </form>
    </main>
  );
}
