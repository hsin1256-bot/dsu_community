'use client';

import React from 'react';
import { Bookmark, GraduationCap, User } from 'lucide-react';
import { ScheduleKind, KIND_THEME_COLORS } from '../utils';

interface ScheduleTypeIconProps {
  kind: ScheduleKind;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  bgColor?: string; // 해당 일정의 배경 색상과 100% 동일하게 일치
  className?: string;
}

/**
 * 🎨 사용자 지정 일정 유형 원형 아이콘 (북마크 일정 🔖, 학사일정 🎓, 개인일정 👤)
 * - 배경 색상: 지정된 일정의 고유 색상(`bgColor`)과 100% 동일하게 일치
 * - 북마크 일정: 흰색 북마크 아이콘
 * - 학사일정: 흰색 학사모 아이콘
 * - 개인일정: 흰색 사람 아이콘
 */
export default function ScheduleTypeIcon({
  kind,
  size = 'sm',
  bgColor,
  className = '',
}: ScheduleTypeIconProps) {
  const sizeClasses = {
    xs: { circle: 'w-3 h-3', icon: 'w-1.5 h-1.5' },
    sm: { circle: 'w-4 h-4', icon: 'w-2.5 h-2.5' },
    md: { circle: 'w-5 h-5', icon: 'w-3 h-3' },
    lg: { circle: 'w-7 h-7', icon: 'w-4 h-4' },
  }[size];

  // 지정된 bgColor 가 있으면 해당 일정의 색상을 그대로 사용, 없으면 유형 기본 테마색 사용
  const effectiveBgColor = bgColor || KIND_THEME_COLORS[kind];

  const commonStyle = {
    backgroundColor: effectiveBgColor,
  };

  const ringClass = size === 'xs' ? 'ring-[0.5px] ring-white/60' : 'ring-1 ring-white/40 shadow-xs';

  if (kind === 'bookmark') {
    return (
      <span
        style={commonStyle}
        className={`rounded-full flex items-center justify-center shrink-0 text-white select-none ${ringClass} ${sizeClasses.circle} ${className}`}
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
        style={commonStyle}
        className={`rounded-full flex items-center justify-center shrink-0 text-white select-none ${ringClass} ${sizeClasses.circle} ${className}`}
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
      style={commonStyle}
      className={`rounded-full flex items-center justify-center shrink-0 text-white select-none ${ringClass} ${sizeClasses.circle} ${className}`}
      title="개인일정"
      aria-label="개인일정"
    >
      <User className={`${sizeClasses.icon} fill-white stroke-white stroke-[2]`} />
    </span>
  );
}
