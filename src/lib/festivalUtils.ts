import { Festival, FestivalStatusType } from '@/types';

// 오늘 날짜 문자열 (YYYY-MM-DD)
export function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 두 날짜 간 남은 일수 (D-Day) 계산
export function getDiffDays(startDateStr: string): number {
  if (!startDateStr) return 0;
  const today = new Date(getTodayString()).getTime();
  const start = new Date(startDateStr).getTime();
  if (isNaN(today) || isNaN(start)) return 0;

  const diffTime = start - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// 축제 상태 (LIVE vs UPCOMING vs EXPIRED) 계산
export function getFestivalStatus(festival: Festival): FestivalStatusType {
  const today = getTodayString();
  const { startDate, endDate } = festival;

  if (endDate && endDate < today) {
    return 'EXPIRED';
  }

  if (startDate && startDate <= today && endDate && endDate >= today) {
    return 'LIVE';
  }

  if (startDate && startDate > today) {
    return 'UPCOMING';
  }

  return 'LIVE';
}

// D-Day 표현 문자열 생성 (예: "D-15", "D-61", "D-DAY")
export function getDDayString(startDateStr: string): string {
  const diffDays = getDiffDays(startDateStr);
  if (diffDays <= 0) return 'D-DAY';
  return `D-${diffDays}`;
}
