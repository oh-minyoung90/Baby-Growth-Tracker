import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  calculateSleepValues,
  defaultSleepDate,
  emptySleepValues,
  serverFieldError,
  sleepSchema,
  toSleepFormValues,
  type SleepFormValues,
} from './sleepSchema'

// 수면 입력 검증 (FR-SLEEP-02~07). 오늘은 2026-10-22, 생년월일은 2026-01-08 (가명 데이터)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 22, 9, 0))
})
afterEach(() => vi.useRealTimers())

const schema = sleepSchema('2026-01-08')

function values(patch: Partial<SleepFormValues>): SleepFormValues {
  return { ...emptySleepValues('2026-10-19'), ...patch }
}

/** 오류가 난 입력칸 → 문구 */
function errors(input: SleepFormValues): Record<string, string> {
  const result = schema.safeParse(input)
  if (result.success) return {}
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
  )
}

describe('저장할 값 (BR-05)', () => {
  it('시각에 날짜를 붙이고, 낮잠은 시작 순서로, 빈 낮잠 줄은 빼고 저장한다', () => {
    const parsed = schema.parse(
      values({
        bedTime: '21:30',
        wakeTime: '07:10',
        naps: [
          { start: '14:30', end: '15:40' },
          { start: '', end: '' },
          { start: '10:00', end: '11:20' },
        ],
        memo: '  이앓이 ',
      }),
    )
    expect(parsed).toEqual({
      date: '2026-10-19',
      bedAt: '2026-10-19T21:30',
      wakeAt: '2026-10-20T07:10',
      naps: [
        { startAt: '2026-10-19T10:00', endAt: '2026-10-19T11:20' },
        { startAt: '2026-10-19T14:30', endAt: '2026-10-19T15:40' },
      ],
      memo: '이앓이',
    })
  })

  it('잠든 시간이나 일어난 시간 하나만 있어도 저장한다 (FR-SLEEP-06)', () => {
    expect(schema.parse(values({ wakeTime: '06:50' }))).toMatchObject({
      bedAt: null,
      wakeAt: '2026-10-20T06:50',
      naps: [],
      memo: null,
    })
  })

  it('자정 넘어 잠들면 다음 날 시각이다', () => {
    expect(schema.parse(values({ bedTime: '00:30', wakeTime: '08:00' }))).toMatchObject({
      bedAt: '2026-10-20T00:30',
      wakeAt: '2026-10-20T08:00',
    })
  })
})

describe('오류 (FR-SLEEP-02, 07)', () => {
  it('시간을 하나도 입력하지 않으면 밤잠 칸에 안내한다', () => {
    expect(errors(values({}))).toEqual({
      bedTime: '잠든 시간, 일어난 시간, 낮잠 중 하나 이상 입력해 주세요',
    })
  })

  it('밤잠이 16시간을 넘거나 1시간 미만이면 일어난 시간 칸에 안내한다', () => {
    const message = '밤잠은 1시간 이상 16시간 이하여야 해요'
    expect(errors(values({ bedTime: '18:00', wakeTime: '10:30' }))).toEqual({ wakeTime: message })
    expect(errors(values({ bedTime: '21:00', wakeTime: '21:30' }))).toEqual({ wakeTime: message })
  })

  it('낮잠 오류는 그 낮잠 줄에 표시한다', () => {
    expect(
      errors(
        values({
          bedTime: '15:00',
          naps: [
            { start: '10:00', end: '09:00' },
            { start: '13:00', end: '' },
            { start: '', end: '12:00' },
            { start: '14:00', end: '15:30' },
          ],
        }),
      ),
    ).toEqual({
      'naps.0.end': '낮잠 1: 끝 시간이 시작 시간보다 늦어야 해요',
      'naps.1.end': '낮잠 2: 시작과 끝 시간을 모두 입력해 주세요',
      'naps.2.start': '낮잠 3: 시작과 끝 시간을 모두 입력해 주세요',
      'naps.3.end': '낮잠 4: 밤잠 시간과 겹쳐요',
    })
  })

  it('낮잠끼리 겹치면 뒤쪽 낮잠 줄에 표시한다', () => {
    expect(
      errors(
        values({
          naps: [
            { start: '10:00', end: '11:20' },
            { start: '11:00', end: '12:00' },
          ],
        }),
      ),
    ).toEqual({ 'naps.1.start': '낮잠 1, 낮잠 2: 시간이 서로 겹쳐요' })
  })

  it('수면일 오류와 시간 오류를 함께 안내한다', () => {
    expect(errors(values({ date: '2026-10-23', bedTime: '18:00', wakeTime: '10:30' }))).toEqual({
      date: '오늘 이후 날짜는 고를 수 없어요',
      wakeTime: '밤잠은 1시간 이상 16시간 이하여야 해요',
    })
  })
})

describe('입력값과 저장된 기록', () => {
  it('저장된 기록에서 시각만 꺼내 입력칸에 채운다', () => {
    expect(
      toSleepFormValues({
        id: 's1',
        date: '2026-10-19',
        bedAt: '2026-10-19T21:30',
        wakeAt: '2026-10-20T07:10',
        naps: [{ startAt: '2026-10-19T10:00', endAt: '2026-10-19T11:20' }],
        memo: null,
      }),
    ).toEqual({
      date: '2026-10-19',
      bedTime: '21:30',
      wakeTime: '07:10',
      naps: [{ start: '10:00', end: '11:20' }],
      memo: '',
    })
  })

  it('수면일이 올바르지 않으면 계산하지 않는다', () => {
    expect(calculateSleepValues(values({ date: '', bedTime: '21:00' }))).toBeNull()
  })
})

describe('defaultSleepDate (FR-SLEEP-01)', () => {
  it('기본값은 어제이고, 어제가 생년월일 이전이면 생년월일이다', () => {
    expect(defaultSleepDate('2026-01-08')).toBe('2026-10-21')
    expect(defaultSleepDate('2026-10-22')).toBe('2026-10-22')
  })
})

describe('serverFieldError (FR-COM-13)', () => {
  it('서버 검증 실패를 입력칸 문구로 바꾼다', () => {
    expect(serverFieldError('duplicateDate')).toEqual({
      field: 'date',
      message: '이 수면일에 이미 기록이 있어요',
    })
    expect(serverFieldError('futureDate')?.field).toBe('date')
    expect(serverFieldError('memoLength')).toEqual({
      field: 'memo',
      message: '500자까지 입력할 수 있어요',
    })
    expect(serverFieldError('network')).toBeNull()
  })
})
