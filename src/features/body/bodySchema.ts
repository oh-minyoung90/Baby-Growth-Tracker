import { z } from 'zod'
import { DATE_MESSAGES, maxLengthMessage, optionalText, recordDate } from '@/lib/validation'
import type { BodySaveErrorReason } from './bodyApi'

/** 키·몸무게 입력 검증 (FR-BODY-01~02). DB의 CHECK 제약(T-15)과 같은 규칙이다 */

export const MEMO_MAX = 500

export const BODY_MESSAGES = {
  height: '키는 30~150cm 사이로 입력해 주세요',
  weight: '몸무게는 1~50kg 사이로 입력해 주세요',
  heightOrWeight: '키와 몸무게 중 하나 이상 입력해 주세요',
  duplicateDate: '같은 날짜에 측정 기록이 있어요',
} as const

/** 소수점 첫째 자리까지의 숫자: '72', '72.', '72.5' */
const DECIMAL_PATTERN = /^\d+(\.\d?)?$/

/** 입력하는 중에 받아들일 수 있는 모양: 정수 세 자리, 소수점 첫째 자리까지 ('', '.', '7', '72.'도 허용) */
const TYPING_PATTERN = /^\d{0,3}(\.\d?)?$/

/**
 * 숫자 칸에 새로 입력된 값을 받아들일지 정한다. 맞지 않으면 이전 값을 그대로 둔다.
 * 소수점 둘째 자리나 숫자가 아닌 글자는 입력되지 않는다. 쉼표는 소수점으로 바꾼다 (기기 키패드에 따라 다름).
 */
export function acceptDecimalInput(next: string, previous: string): string {
  const value = next.replace(',', '.')
  return TYPING_PATTERN.test(value) ? value : previous
}

/** 비어 있으면 null, 아니면 범위 안의 숫자 */
function measureValue(min: number, max: number, message: string) {
  return z
    .string()
    .trim()
    .refine(
      (value) =>
        value === '' ||
        (DECIMAL_PATTERN.test(value) && Number(value) >= min && Number(value) <= max),
      message,
    )
    .transform((value) => (value === '' ? null : Number(value)))
}

export function bodyMeasureSchema(birthDate: string) {
  return z
    .object({
      date: recordDate({ birthDate }),
      heightCm: measureValue(30, 150, BODY_MESSAGES.height),
      weightKg: measureValue(1, 50, BODY_MESSAGES.weight),
      memo: optionalText(MEMO_MAX),
    })
    .refine((value) => value.heightCm !== null || value.weightKg !== null, {
      message: BODY_MESSAGES.heightOrWeight,
      path: ['heightCm'],
    })
}

export type BodyFormValues = z.input<ReturnType<typeof bodyMeasureSchema>>

/** 서버(DB) 검증 실패를 화면 검증과 같은 입력칸·문구로 바꾼다 (FR-COM-13). 네트워크 오류는 null */
export function serverFieldError(
  reason: BodySaveErrorReason,
): { field: keyof BodyFormValues; message: string } | null {
  switch (reason) {
    case 'futureDate':
      return { field: 'date', message: DATE_MESSAGES.future }
    case 'beforeBirth':
      return { field: 'date', message: DATE_MESSAGES.beforeBirth }
    case 'duplicateDate':
      return { field: 'date', message: BODY_MESSAGES.duplicateDate }
    case 'heightRange':
      return { field: 'heightCm', message: BODY_MESSAGES.height }
    case 'weightRange':
      return { field: 'weightKg', message: BODY_MESSAGES.weight }
    case 'heightOrWeight':
      return { field: 'heightCm', message: BODY_MESSAGES.heightOrWeight }
    case 'memoLength':
      return { field: 'memo', message: maxLengthMessage(MEMO_MAX) }
    case 'network':
      return null
  }
}
