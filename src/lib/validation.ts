import { z } from 'zod'
import { isValidDateString, todayString } from '@/domain/date'

/**
 * 입력 검증 규칙 (기능요구사항서 3.1, 3.3). 화면마다 Zod 스키마를 만들 때 조합해서 쓴다.
 * 같은 검증을 DB에도 둔다 (FR-COM-13).
 */

export const DATE_MESSAGES = {
  required: '날짜를 선택해 주세요',
  invalid: '날짜를 다시 확인해 주세요',
  future: '오늘 이후 날짜는 고를 수 없어요',
  beforeBirth: '생년월일 이전 날짜는 고를 수 없어요',
} as const

export function maxLengthMessage(max: number): string {
  return `${max}자까지 입력할 수 있어요`
}

/** 필수 글자 입력: 앞뒤 공백을 지우고, 공백만 있으면 빈 값으로 본다 (FR-COM-10~12) */
export function requiredText(max: number, emptyMessage: string) {
  return z.string().trim().min(1, emptyMessage).max(max, maxLengthMessage(max))
}

/** 선택 글자 입력(메모 등): 앞뒤 공백을 지우고, 비어 있으면 null로 저장한다 */
export function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, maxLengthMessage(max))
    .transform((value) => (value === '' ? null : value))
}

/**
 * 기록 날짜 (FR-COM-02~04): 오늘 이후(주간 식단은 허용)와 생년월일 이전은 고를 수 없다.
 * "오늘"은 검증하는 순간 기기의 날짜다 (FR-COM-01).
 * 문구는 하나만 낸다. 검사를 중단(abort)하지 않으므로 폼 전체 규칙(예: 키·몸무게 중 하나 이상)도 함께 검사된다.
 */
export function recordDate({
  birthDate,
  allowFuture = false,
}: { birthDate?: string; allowFuture?: boolean } = {}) {
  return z.string().superRefine((value, ctx) => {
    const message = dateProblem(value, birthDate, allowFuture)
    if (message) ctx.addIssue({ code: 'custom', message })
  })
}

function dateProblem(value: string, birthDate: string | undefined, allowFuture: boolean) {
  if (value === '') return DATE_MESSAGES.required
  if (!isValidDateString(value)) return DATE_MESSAGES.invalid
  if (!allowFuture && value > todayString()) return DATE_MESSAGES.future
  if (birthDate && value < birthDate) return DATE_MESSAGES.beforeBirth
  return null
}
