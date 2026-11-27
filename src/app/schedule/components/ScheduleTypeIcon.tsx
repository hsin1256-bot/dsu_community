'use client';

import React from 'react';
import { Bookmark, GraduationCap, User } from 'lucide-react';
import { ScheduleKind } from '../utils';

interface ScheduleTypeIconProps {
  kind: ScheduleKind;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * 🎨 사용자 지정 일정 유형 원형 아이콘 (북마크 일정 🔖, 학사일정 🎓, 개인일정 👤)
 * - 북마크 일정: 파란색 원(#0080FF) + 흰색 북마크 아이콘
 * - 학사일정: 보라색 원(#9A25E2) + 흰색 학사모 아이콘
 * - 개인일정: 초록색 원(#52C41A) + 흰색 사람 아이콘
 */
export default function ScheduleTypeIcon({
  kind,
  size = 'sm',
  className = '',
}: ScheduleTypeIconProps) {
  const sizeClasses = {
    xs: { circle: 'w-3 h-3', icon: 'w-1.5 h-1.5' },
    sm: { circle: 'w-4 h-4', icon: 'w-2.5 h-2.5' },
    md: { circle: 'w-5 h-5', icon: 'w-3 h-3' },
    lg: { circle: 'w-7 h-7', icon: 'w-4 h-4' },
  }[size];

  if (kind === 'bookmark') {
    return (
      <span
        className={`rounded-full flex items-center justify-center shrink-0 bg-[#0080FF] text-white shadow-2xs select-none ${sizeClasses.circle} ${className}`}
        title="북마크 일정"
        aria-label="북마크 일정"
      >
        <Bookmark className={`${sizeClasses.icon} fill-white stroke-white stroke-[2.5]`} />
      </span>
    );
  }

  if (kind === 'academic') {
    return (
      <span
        className={`rounded-full flex items-center justify-center shrink-0 bg-[#9A25E2] text-white shadow-2xs select-none ${sizeClasses.circle} ${className}`}
        title="학사일정"
        aria-label="학사일정"
      >
        <GraduationCap className={`${sizeClasses.icon} fill-white stroke-white stroke-[2]`} />
      </span>
    );
  }

  // personal
  return (
    <span
      className={`rounded-full flex items-center justify-center shrink-0 bg-[#52C41A] text-white shadow-2xs select-none ${sizeClasses.circle} ${className}`}
      title="개인일정"
      aria-label="개인일정"
    >
      <User className={`${sizeClasses.icon} fill-white stroke-white stroke-[2]`} />
    </span>
  );
}
