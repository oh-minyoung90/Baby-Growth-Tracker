import type { PostgrestError } from '@supabase/supabase-js'
import { todayString } from '@/domain/date'

/** DB 검증 실패를 화면 문구로 나누는 공통 규칙 (FR-COM-13) */

/**
 * 날짜 검증 트리거(22007, T-08·T-15)는 오늘 이후와 생년월일 이전이 같은 오류 코드라 날짜를 보고 나눈다.
 * 22007이 아니면 null
 */
export function dateErrorReason(
  error: PostgrestError,
  date: string,
): 'futureDate' | 'beforeBirth' | null {
  if (error.code !== '22007') return null
  return date > todayString() ? 'futureDate' : 'beforeBirth'
}

/** CHECK 제약 위반(23514)이면 오류 문구에 든 제약 이름을 찾는다. 아니면 undefined */
export function violatedCheck<T extends string>(
  error: PostgrestError,
  names: readonly T[],
): T | undefined {
  if (error.code !== '23514') return undefined
  return names.find((name) => error.message.includes(name))
}
