import { format, isValid } from 'date-fns'
import { ko } from 'date-fns/locale'

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * 'YYYY-MM-DD' 문자열을 기기 시간대의 그날 0시 Date로 바꾼다.
 * new Date('2026-01-08')은 UTC 기준으로 해석되어 시간대에 따라 하루가 밀릴 수 있으므로 직접 나눠서 만든다.
 */
export function parseDate(value: string): Date {
  const match = DATE_PATTERN.exec(value)
  if (!match) {
    throw new RangeError(`날짜 형식이 올바르지 않습니다: ${value} (YYYY-MM-DD)`)
  }
  const [, y, m, d] = match.map(Number)
  const date = new Date(y, m - 1, d)
  // 2026-02-30처럼 존재하지 않는 날짜는 다음 달로 넘어가므로 다시 비교해 걸러낸다
  if (
    !isValid(date) ||
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    throw new RangeError(`존재하지 않는 날짜입니다: ${value}`)
  }
  return date
}

/** 기기 시간대 기준 오늘 'YYYY-MM-DD' (PRD 결정 사항: 시간대는 기기의 현재 시각 기준) */
export function todayString(now: Date = new Date()): string {
  return format(now, 'yyyy-MM-dd')
}

/** 'YYYY-MM-DD' → '2026. 1. 8. (목)' (기능요구사항서 FR-COM-05) */
export function formatDateLabel(value: string): string {
  return format(parseDate(value), 'yyyy. M. d. (EEE)', { locale: ko })
}
