import React from 'react';

export interface PolicySection {
  title: string;
  body: (string | string[])[];
}

/** 약관/방침 공통 렌더러: 문자열은 문단, 배열은 목록 */
export default function PolicyDocument({ updatedAt, intro, sections }: { updatedAt: string; intro: string; sections: PolicySection[] }) {
  return (
    <article className="p-4 space-y-4 text-sm text-slate-700 leading-relaxed">
      <div className="bg-amber-50 border border-amber-200 text-amber-900 text-[11px] rounded-2xl p-3">
        초안입니다. 공개 전에 팀에서 내용을 확정하고, [대괄호] 부분을 채워 주세요.
      </div>
      <p className="text-xs text-slate-400">시행일: {updatedAt}</p>
      <p>{intro}</p>
      {sections.map((s, i) => (
        <section key={s.title} className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2">
          <h2 className="text-sm font-bold text-slate-900">
            제{i + 1}조 {s.title}
          </h2>
          {s.body.map((b, j) =>
            Array.isArray(b) ? (
              <ul key={j} className="list-disc pl-5 space-y-1 text-xs">
                {b.map((li) => (
                  <li key={li}>{li}</li>
                ))}
              </ul>
            ) : (
              <p key={j} className="text-xs">
                {b}
              </p>
            )
          )}
        </section>
      ))}
    </article>
  );
}
