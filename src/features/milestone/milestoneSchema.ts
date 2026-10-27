import { z } from 'zod'
import { MILESTONE_TYPE_VALUES } from '@/lib/milestoneTypes'
import {
  DATE_MESSAGES,
  maxLengthMessage,
  optionalText,
  recordDate,
  requiredText,
} from '@/lib/validation'
import type { MilestoneSaveErrorReason } from './milestoneApi'

/** 발달 기록 입력 검증 (FR-MS-02, FR-COM-10~12). DB의 CHECK 제약(T-18)과 같은 규칙이다 */

export const TITLE_MAX = 30
export const MEMO_MAX = 500

export const MILESTONE_MESSAGES = {
  type: '유형을 골라 주세요',
  title: '내용을 입력해 주세요',
} as const

export function milestoneSchema(birthDate: string) {
  return z.object({
    // 아직 고르지 않았으면 ''. 저장할 때는 네 유형 중 하나여야 한다
    type: z.union([z.literal(''), z.enum(MILESTONE_TYPE_VALUES)]).transform((value, ctx) => {
      if (value !== '') return value
      ctx.addIssue({ code: 'custom', message: MILESTONE_MESSAGES.type })
      return z.NEVER
    }),
    date: recordDate({ birthDate }),
    title: requiredText(TITLE_MAX, MILESTONE_MESSAGES.title),
    memo: optionalText(MEMO_MAX),
  })
}

export type MilestoneFormValues = z.input<ReturnType<typeof milestoneSchema>>

/** 서버(DB) 검증 실패를 화면 검증과 같은 입력칸·문구로 바꾼다 (FR-COM-13). 네트워크 오류는 null */
export function serverFieldError(
  reason: MilestoneSaveErrorReason,
): { field: keyof MilestoneFormValues; message: string } | null {
  switch (reason) {
    case 'futureDate':
      return { field: 'date', message: DATE_MESSAGES.future }
    case 'beforeBirth':
      return { field: 'date', message: DATE_MESSAGES.beforeBirth }
    case 'titleLength':
      return { field: 'title', message: maxLengthMessage(TITLE_MAX) }
    case 'memoLength':
      return { field: 'memo', message: maxLengthMessage(MEMO_MAX) }
    case 'network':
      return null
  }
}
