import React from 'react';
import Link from 'next/link';
import { ChevronRight, LucideIcon } from 'lucide-react';

export interface MenuItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description?: string;
  badge?: string | number;
}

/** 마이페이지 공통 메뉴 묶음 */
export default function MenuList({ title, items }: { title: string; items: MenuItem[] }) {
  return (
    <section>
      <h2 className="text-[11px] font-bold text-slate-400 px-1 mb-1.5">{title}</h2>
      <ul className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
        {items.map(({ href, label, icon: Icon, description, badge }) => (
          <li key={href}>
            <Link href={href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 active:bg-slate-100 transition">
              <span className="w-8 h-8 rounded-xl bg-dongseo-50 text-dongseo-700 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-slate-800">{label}</span>
                {description && <span className="block text-[11px] text-slate-400 truncate">{description}</span>}
              </span>
              {badge !== undefined && badge !== 0 && (
                <span className="text-[11px] font-bold text-dongseo-700 bg-dongseo-50 px-2 py-0.5 rounded-full">{badge}</span>
              )}
              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
