import { Festival, FestivalStatusType } from '@/types';

// 기준 날짜 (2026-08-20)
export const CURRENT_DATE_STR = '2026-08-20';

/**
 * 날짜 문자열(YYYY-MM-DD)을 기반으로 자정 기준 Date 객체 반환
 */
export function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * 두 날짜 간의 일수 차이 계산 (targetDate - baseDate)
 */
export function getDiffDays(targetDateStr: string, baseDateStr: string = CURRENT_DATE_STR): number {
  const target = parseDate(targetDateStr);
  const base = parseDate(baseDateStr);
  const diffTime = target.getTime() - base.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * 축제 기간 상태 계산
 * - 'LIVE': startDate <= 오늘 <= endDate
 * - 'UPCOMING': 오늘 < startDate 이면서 D-Day <= 7
 * - 'EXPIRED': endDate < 오늘
 * - 'FAR_FUTURE': 오늘 < startDate 이면서 D-Day > 7
 */
export function getFestivalStatus(
  festival: Festival,
  baseDateStr: string = CURRENT_DATE_STR
): FestivalStatusType {
  const today = parseDate(baseDateStr).getTime();
  const start = parseDate(festival.startDate).getTime();
  const end = parseDate(festival.endDate).getTime();

  if (end < today) {
    return 'EXPIRED';
  }

  if (start <= today && today <= end) {
    return 'LIVE';
  }

  const dDay = getDiffDays(festival.startDate, baseDateStr);
  if (dDay > 0 && dDay <= 7) {
    return 'UPCOMING';
  }

  return 'FAR_FUTURE';
}

/**
 * D-Day 표기 문자열 반환 (예: "D-3", "D-DAY")
 */
export function getDDayString(startDateStr: string, baseDateStr: string = CURRENT_DATE_STR): string {
  const dDay = getDiffDays(startDateStr, baseDateStr);
  if (dDay === 0) return 'D-DAY';
  if (dDay > 0) return `D-${dDay}`;
  return `D+${Math.abs(dDay)}`;
}
