import { z } from 'zod'
import { isValidDateString, yesterdayString } from '@/domain/date'
import {
  calculateSleep,
  sleepErrorMessage,
  type SleepError,
  type SleepResult,
} from '@/domain/sleep'
import type { SleepLog, SleepLogInput, SleepSaveErrorReason } from '@/lib/sleepApi'
import { DATE_MESSAGES, maxLengthMessage, optionalText, recordDate } from '@/lib/validation'

/**
 * 수면 입력 검증 (FR-SLEEP-02~07, FR-COM-10~13).
 * 시각은 'HH:MM'만 입력받고, 날짜 붙이기와 오류 판정은 domain/sleep.ts(BR-04~07)가 한다.
 * DB의 검증 트리거(T-24)와 같은 규칙이다.
 */

export const MEMO_MAX = 500

export const SLEEP_MESSAGES = {
  duplicateDate: '이 수면일에 이미 기록이 있어요',
} as const

/** 입력 중인 값. 시각은 'HH:MM', 비어 있으면 '' */
export interface SleepFormValues {
  date: string
  bedTime: string
  wakeTime: string
  naps: { start: string; end: string }[]
  memo: string
}

/**
 * 새 기록의 수면일 기본값: 어제 (FR-SLEEP-01, R25). 아침에 지난밤 수면을 기록하는 경우가 많기 때문이다.
 * 오늘 태어나 어제가 생년월일 이전이면 생년월일
 */
export function defaultSleepDate(birthDate: string): string {
  const yesterday = yesterdayString()
  return yesterday < birthDate ? birthDate : yesterday
}

/** 새 기록의 빈 입력. 수면일만 정해 둔다 */
export function emptySleepValues(date: string): SleepFormValues {
  return { date, bedTime: '', wakeTime: '', naps: [], memo: '' }
}

/** 저장된 기록 → 입력값. 날짜가 붙은 시각에서 시각만 꺼낸다 */
export function toSleepFormValues(log: SleepLog, date = log.date): SleepFormValues {
  const time = (value: string | null) => value?.slice(11, 16) ?? ''
  return {
    date,
    bedTime: time(log.bedAt),
    wakeTime: time(log.wakeAt),
    naps: log.naps.map((nap) => ({ start: time(nap.startAt), end: time(nap.endAt) })),
    memo: log.memo ?? '',
  }
}

/**
 * 입력값으로 밤잠·낮잠·총 수면을 계산한다 (BR-05, BR-07). 입력하는 동안 화면에 바로 보여 준다 (FR-SLEEP-05).
 * 수면일이 올바르지 않거나 시각 형식이 틀리면 계산하지 않는다 (null)
 */
export function calculateSleepValues(
  values: Pick<SleepFormValues, 'date' | 'bedTime' | 'wakeTime' | 'naps'>,
): SleepResult | null {
  if (!isValidDateString(values.date)) return null
  try {
    return calculateSleep({
      sleepDate: values.date,
      bedTime: values.bedTime || null,
      wakeTime: values.wakeTime || null,
      naps: values.naps.map((nap) => ({ start: nap.start || null, end: nap.end || null })),
    })
  } catch {
    return null
  }
}

/**
 * 오류를 보여 줄 입력칸 (FR-COM-10: 해당 입력칸 아래).
 * 밤잠 오류는 밤잠 칸 아래, 낮잠 오류는 그 낮잠 줄 아래. 겹침은 뒤쪽 낮잠에 표시한다
 */
function errorPath(error: SleepError, naps: SleepFormValues['naps']): (string | number)[] {
  switch (error.code) {
    case 'EMPTY':
      return ['bedTime']
    case 'NIGHT_OUT_OF_RANGE':
      return ['wakeTime']
    case 'NAP_INCOMPLETE':
      return ['naps', error.index, naps[error.index]?.start ? 'end' : 'start']
    case 'NAP_END_NOT_AFTER_START':
    case 'NAP_OVERLAPS_NIGHT':
      return ['naps', error.index, 'end']
    case 'NAPS_OVERLAP':
      return ['naps', error.other, 'start']
  }
}

export function sleepSchema(birthDate: string) {
  return z
    .object({
      date: recordDate({ birthDate }),
      bedTime: z.string(),
      wakeTime: z.string(),
      naps: z.array(z.object({ start: z.string(), end: z.string() })),
      memo: optionalText(MEMO_MAX),
    })
    .superRefine((values, ctx) => {
      // 수면일이 올바르지 않으면 계산할 수 없다. 수면일 오류는 수면일 칸에서 안내한다
      for (const error of calculateSleepValues(values)?.errors ?? []) {
        ctx.addIssue({
          code: 'custom',
          path: errorPath(error, values.naps),
          message: sleepErrorMessage(error),
        })
      }
    })
    .transform((values): SleepLogInput => {
      // 검증을 통과했으므로 수면일과 시각이 올바르다
      const result = calculateSleepValues(values)
      return {
        date: values.date,
        bedAt: result?.bedAt ?? null,
        wakeAt: result?.wakeAt ?? null,
        // 낮잠은 시작 시각 순서로 저장한다. 빈 줄은 빠진다
        naps: [...(result?.naps ?? [])].sort((a, b) => a.startAt.localeCompare(b.startAt)),
        memo: values.memo,
      }
    })
}

/** 서버(DB) 검증 실패를 화면 검증과 같은 입력칸·문구로 바꾼다 (FR-COM-13). 네트워크 오류는 null */
export function serverFieldError(
  reason: SleepSaveErrorReason,
): { field: keyof SleepFormValues; message: string } | null {
  switch (reason) {
    case 'futureDate':
      return { field: 'date', message: DATE_MESSAGES.future }
    case 'beforeBirth':
      return { field: 'date', message: DATE_MESSAGES.beforeBirth }
    case 'duplicateDate':
      return { field: 'date', message: SLEEP_MESSAGES.duplicateDate }
    case 'memoLength':
      return { field: 'memo', message: maxLengthMessage(MEMO_MAX) }
    case 'network':
      return null
  }
}
