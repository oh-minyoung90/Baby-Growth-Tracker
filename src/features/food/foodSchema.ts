import { z } from 'zod'
import type {
  CautionInput,
  CautionSaveErrorReason,
  FoodInput,
  FoodSaveErrorReason,
} from '@/lib/foodApi'
import { FOOD_GROUP_VALUES, FOOD_PREFERENCE_VALUES } from '@/lib/foodTypes'
import {
  DATE_MESSAGES,
  maxLengthMessage,
  optionalRecordDate,
  optionalText,
  recordDate,
  requiredText,
} from '@/lib/validation'

/** 음식 추가·수정과 알러지·주의 검증 (FR-FOOD-04~05, 11~13, R45). DB의 CHECK 제약(T-36, T-38)과 같은 규칙이다 */

export const NAME_MAX = 20
export const MEMO_MAX = 500

export const FOOD_MESSAGES = {
  name: '음식 이름을 입력해 주세요',
  group: '식품군을 골라 주세요',
  duplicate: '이미 있는 음식이에요',
} as const

/** 폼 결과: 음식 입력 + 알러지·주의 음식이면 함께 고친 알러지·주의 정보 */
export interface FoodFormOutput extends FoodInput {
  caution: CautionInput | null
}

/** 알러지·주의 정보 (FR-FOOD-11): 반응 날짜(필수, 오늘까지), 증상 메모·확인 메모(각 500자) */
function cautionFields(birthDate: string) {
  return {
    reactionDate: recordDate({ birthDate }),
    symptomNote: optionalText(MEMO_MAX),
    checkNote: optionalText(MEMO_MAX),
  }
}

/** caution: 알러지·주의 음식을 고치는 폼이면 true. 알러지·주의 정보도 함께 검사한다 */
export function foodSchema(birthDate: string, { caution = false }: { caution?: boolean } = {}) {
  const info = cautionFields(birthDate)
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
      // 먹어봄(true) / 아직 안 먹어봄(false). null: 알러지·주의 음식이라 바꾸지 않음
      alreadyTried: z.boolean().nullable(),
      // 처음 먹은 날(선택). 아직 안 먹어봄으로 바꾸면 화면에서 비운다
      firstTriedDate: optionalRecordDate({ birthDate }),
      // 아이 반응(선택, R46). 고르지 않았으면 null
      preference: z.enum(FOOD_PREFERENCE_VALUES).nullable(),
      // 알러지·주의 정보. 알러지·주의 음식이 아니면 화면에 없으므로 검사하지 않는다
      reactionDate: caution ? info.reactionDate : z.string(),
      symptomNote: caution ? info.symptomNote : z.string(),
      checkNote: caution ? info.checkNote : z.string(),
    })
    .transform(({ reactionDate, symptomNote, checkNote, ...value }): FoodFormOutput => ({
      ...value,
      firstTriedDate: value.alreadyTried ? value.firstTriedDate : null,
      // 먹어 보지 않은 음식에는 반응이 없다. 알러지·주의 음식(null)은 저장된 반응을 그대로 둔다
      preference: value.alreadyTried === false ? null : value.preference,
      caution: caution ? { reactionDate, symptomNote, checkNote } : null,
    }))
}

export type FoodFormValues = z.input<ReturnType<typeof foodSchema>>

/** 알러지·주의 지정 (FR-FOOD-11, R48). 사유(선택)는 이력에 남는다 */
export function cautionSchema(birthDate: string) {
  return z.object({ ...cautionFields(birthDate), reason: optionalText(MEMO_MAX) })
}

export type CautionFormValues = z.input<ReturnType<typeof cautionSchema>>
export type CautionFormOutput = z.output<ReturnType<typeof cautionSchema>>

/** 알러지·주의 해제·"주의" 태그 해제 사유 (선택, FR-FOOD-12~13) */
export const reasonSchema = z.object({ reason: optionalText(MEMO_MAX) })

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

/** 알러지·주의 지정·해제의 서버(DB) 검증 실패를 입력칸·문구로 바꾼다 (FR-COM-13). 네트워크 오류는 null */
export function serverCautionFieldError(reason: CautionSaveErrorReason): {
  field: 'reactionDate' | 'symptomNote' | 'checkNote' | 'reason'
  message: string
} | null {
  switch (reason) {
    case 'futureDate':
      return { field: 'reactionDate', message: DATE_MESSAGES.future }
    case 'beforeBirth':
      return { field: 'reactionDate', message: DATE_MESSAGES.beforeBirth }
    case 'symptomLength':
      return { field: 'symptomNote', message: maxLengthMessage(MEMO_MAX) }
    case 'checkNoteLength':
      return { field: 'checkNote', message: maxLengthMessage(MEMO_MAX) }
    case 'reasonLength':
      return { field: 'reason', message: maxLengthMessage(MEMO_MAX) }
    case 'network':
      return null
  }
}
