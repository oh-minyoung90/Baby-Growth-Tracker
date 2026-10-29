import { addDays, format } from 'date-fns'
import { parseDate } from './date'

/**
 * 수면 계산 규칙 (BR-04~07, 기능요구사항서 FR-SLEEP-03~07).
 *
 * 수면 기록 1건 = 수면일 D의 밤잠(D일 밤 ~ D+1일 아침) + D일의 낮잠 (BR-04, BR-06).
 * 화면에서는 시각(HH:MM)만 입력받고 날짜는 아래 규칙으로 붙인다 (BR-05).
 * - 잠든 시각이 12:00~23:59이면 D일, 00:00~11:59이면 D+1일 (자정 넘어 잠든 경우)
 * - 일어난 시각은 잠든 시각 이후 처음 오는 그 시각
 * - 낮잠은 모두 D일
 * 계산은 "수면일 D 0시부터 몇 분 뒤인가"로 한다. 시각 문자열을 Date로 바꾸지 않아 일광 절약 시간의 영향을 받지 않는다.
 */

const NOON = 12 * 60
const DAY = 24 * 60
const NIGHT_MIN = 60
const NIGHT_MAX = 16 * 60

export interface NapInput {
  start: string | null
  end: string | null
}

export interface SleepInput {
  /** 수면일 'YYYY-MM-DD' */
  sleepDate: string
  /** 잠든 시각 'HH:MM' */
  bedTime: string | null
  /** 일어난 시각 'HH:MM' */
  wakeTime: string | null
  naps: NapInput[]
}

export type SleepError =
  | { code: 'EMPTY' }
  | { code: 'NIGHT_OUT_OF_RANGE'; minutes: number }
  | { code: 'NAP_INCOMPLETE'; index: number }
  | { code: 'NAP_END_NOT_AFTER_START'; index: number }
  | { code: 'NAPS_OVERLAP'; index: number; other: number }
  | { code: 'NAP_OVERLAPS_NIGHT'; index: number }

export interface SleepResult {
  /** 날짜를 붙인 잠든 시각 'YYYY-MM-DDTHH:MM' */
  bedAt: string | null
  /** 날짜를 붙인 일어난 시각 'YYYY-MM-DDTHH:MM' */
  wakeAt: string | null
  /** 날짜를 붙인 낮잠 */
  naps: { startAt: string; endAt: string }[]
  /** 밤잠(분). 잠든·일어난 시각이 모두 있어야 계산 (FR-SLEEP-06) */
  nightMinutes: number | null
  /** 낮잠 합계(분) */
  napMinutes: number
  /**
   * 총 수면(분) = 밤잠 + 낮잠 (BR-07). 잠든·일어난 시각 중 하나만 있으면 밤잠을 알 수 없어 null.
   * 둘 다 없으면 낮잠 합계
   */
  totalMinutes: number | null
  /** 저장을 막는 오류 (FR-SLEEP-07). 비어 있으면 저장 가능 */
  errors: SleepError[]
}

/** 'HH:MM' → 0시부터 분. 형식이 틀리면 오류 */
export function parseTime(value: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  if (!match) throw new RangeError(`시각 형식이 올바르지 않습니다: ${value} (HH:MM)`)
  return Number(match[1]) * 60 + Number(match[2])
}

/** 수면일 D 0시 기준 분 → 'YYYY-MM-DDTHH:MM' */
function toDateTime(sleepDate: Date, minutesFromD: number): string {
  const day = Math.floor(minutesFromD / DAY)
  const rest = minutesFromD - day * DAY
  const hh = String(Math.floor(rest / 60)).padStart(2, '0')
  const mm = String(rest % 60).padStart(2, '0')
  return `${format(addDays(sleepDate, day), 'yyyy-MM-dd')}T${hh}:${mm}`
}

/** BR-05: 잠든 시각 → 수면일 D 0시 기준 분 */
export function bedMinutesFromD(bedTime: string): number {
  const m = parseTime(bedTime)
  return m < NOON ? m + DAY : m
}

/** BR-05: 일어난 시각 → 잠든 시각 이후 처음 오는 그 시각 (잠든 시각이 없으면 D일 정오 이후) */
export function wakeMinutesFromD(wakeTime: string, bedFromD: number | null): number {
  const base = bedFromD ?? NOON
  let m = parseTime(wakeTime)
  while (m <= base) m += DAY
  return m
}

export function calculateSleep(input: SleepInput): SleepResult {
  const date = parseDate(input.sleepDate)
  const errors: SleepError[] = []

  const bed = input.bedTime ? bedMinutesFromD(input.bedTime) : null
  const wake = input.wakeTime ? wakeMinutesFromD(input.wakeTime, bed) : null

  let nightMinutes: number | null = null
  if (bed !== null && wake !== null) {
    nightMinutes = wake - bed
    if (nightMinutes < NIGHT_MIN || nightMinutes > NIGHT_MAX) {
      errors.push({ code: 'NIGHT_OUT_OF_RANGE', minutes: nightMinutes })
    }
  }

  const naps: { index: number; start: number; end: number }[] = []
  input.naps.forEach((nap, index) => {
    if (!nap.start && !nap.end) return // 빈 줄은 무시
    if (!nap.start || !nap.end) {
      errors.push({ code: 'NAP_INCOMPLETE', index })
      return
    }
    const start = parseTime(nap.start)
    const end = parseTime(nap.end)
    if (end <= start) {
      errors.push({ code: 'NAP_END_NOT_AFTER_START', index })
      return
    }
    if (bed !== null && end > bed) {
      errors.push({ code: 'NAP_OVERLAPS_NIGHT', index })
    }
    naps.push({ index, start, end })
  })

  naps.forEach((a, i) => {
    naps.slice(i + 1).forEach((b) => {
      if (a.start < b.end && b.start < a.end) {
        errors.push({ code: 'NAPS_OVERLAP', index: a.index, other: b.index })
      }
    })
  })

  if (bed === null && wake === null && naps.length === 0 && !errors.length) {
    errors.push({ code: 'EMPTY' })
  }

  const napMinutes = naps.reduce((sum, n) => sum + (n.end - n.start), 0)
  const nightUnknown = (bed === null) !== (wake === null)
  return {
    bedAt: bed === null ? null : toDateTime(date, bed),
    wakeAt: wake === null ? null : toDateTime(date, wake),
    naps: naps.map((n) => ({ startAt: toDateTime(date, n.start), endAt: toDateTime(date, n.end) })),
    nightMinutes,
    napMinutes,
    totalMinutes: nightUnknown ? null : (nightMinutes ?? 0) + napMinutes,
    errors,
  }
}

/** 분 → "N시간 N분" (0분이면 "N시간", 1시간 미만이면 "N분") */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}분`
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`
}

/** 밤잠 표시 (FR-SLEEP-06): 잠든·일어난 시각 중 하나만 있으면 "계산 불가", 둘 다 없으면 "없음" */
export function formatNightSleep({
  bedAt,
  wakeAt,
  nightMinutes,
}: Pick<SleepResult, 'bedAt' | 'wakeAt' | 'nightMinutes'>): string {
  if (nightMinutes !== null) return formatDuration(nightMinutes)
  return bedAt === null && wakeAt === null ? '없음' : '계산 불가'
}

/** 총 수면 표시 (BR-07): 밤잠을 알 수 없으면 "계산 불가" */
export function formatTotalSleep(totalMinutes: number | null): string {
  return totalMinutes === null ? '계산 불가' : formatDuration(totalMinutes)
}

/** 오류 → 화면 안내 문구 (FR-SLEEP-07) */
export function sleepErrorMessage(error: SleepError): string {
  switch (error.code) {
    case 'EMPTY':
      return '잠든 시간, 일어난 시간, 낮잠 중 하나 이상 입력해 주세요'
    case 'NIGHT_OUT_OF_RANGE':
      return '밤잠은 1시간 이상 16시간 이하여야 해요'
    case 'NAP_INCOMPLETE':
      return `낮잠 ${error.index + 1}: 시작과 끝 시간을 모두 입력해 주세요`
    case 'NAP_END_NOT_AFTER_START':
      return `낮잠 ${error.index + 1}: 끝 시간이 시작 시간보다 늦어야 해요`
    case 'NAPS_OVERLAP':
      return `낮잠 ${error.index + 1}, 낮잠 ${error.other + 1}: 시간이 서로 겹쳐요`
    case 'NAP_OVERLAPS_NIGHT':
      return `낮잠 ${error.index + 1}: 밤잠 시간과 겹쳐요`
  }
}
