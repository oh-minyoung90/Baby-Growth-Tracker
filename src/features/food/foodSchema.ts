import { z } from 'zod'
import type { FoodInput, FoodSaveErrorReason } from '@/lib/foodApi'
import { FOOD_GROUP_VALUES } from '@/lib/foodTypes'
import {
  DATE_MESSAGES,
  maxLengthMessage,
  optionalRecordDate,
  optionalText,
  requiredText,
} from '@/lib/validation'

/** 음식 추가·수정 검증 (FR-FOOD-04~05, R45). DB의 CHECK 제약(T-36)과 같은 규칙이다 */

export const NAME_MAX = 20
export const MEMO_MAX = 500

export const FOOD_MESSAGES = {
  name: '음식 이름을 입력해 주세요',
  group: '식품군을 골라 주세요',
  duplicate: '이미 있는 음식이에요',
} as const

export function foodSchema(birthDate: string) {
  return z
    .object({
      name: requiredText(NAME_MAX, FOOD_MESSAGES.name),
      // 아직 고르지 않았으면 ''. 저장할 때는 여섯 식품군 중 하나여야 한다
      group: z.union([z.literal(''), z.enum(FOOD_GROUP_VALUES)]).transform((value, ctx) => {
        if (value !== '') return value
        ctx.addIssue({ code: 'custom', message: FOOD_MESSAGES.group })
        return z.NEVER
      }),
      memo: optionalText(MEMO_MAX),
      // null: 알러지·주의 음식이라 바꾸지 않음
      alreadyTried: z.boolean().nullable(),
      // 처음 먹은 날(선택). "이미 먹어 봤어요"를 끄면 화면에서 비운다
      firstTriedDate: optionalRecordDate({ birthDate }),
    })
    .transform((value): FoodInput => ({
      ...value,
      firstTriedDate: value.alreadyTried ? value.firstTriedDate : null,
    }))
}

export type FoodFormValues = z.input<ReturnType<typeof foodSchema>>

/** 서버(DB) 검증 실패를 화면 검증과 같은 입력칸·문구로 바꾼다 (FR-COM-13). 네트워크 오류는 null */
export function serverFieldError(
  reason: FoodSaveErrorReason,
): { field: keyof FoodFormValues; message: string } | null {
  switch (reason) {
    case 'duplicateName':
      return { field: 'name', message: FOOD_MESSAGES.duplicate }
    case 'nameLength':
      return { field: 'name', message: maxLengthMessage(NAME_MAX) }
    case 'memoLength':
      return { field: 'memo', message: maxLengthMessage(MEMO_MAX) }
    case 'futureDate':
      return { field: 'firstTriedDate', message: DATE_MESSAGES.future }
    case 'beforeBirth':
      return { field: 'firstTriedDate', message: DATE_MESSAGES.beforeBirth }
    case 'network':
      return null
  }
}
