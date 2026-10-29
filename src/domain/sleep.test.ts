import { describe, expect, it } from 'vitest'
import {
  bedMinutesFromD,
  calculateSleep,
  formatDuration,
  formatNapSleep,
  formatNightSleep,
  formatTotalSleep,
  parseTime,
  sleepErrorMessage,
  wakeMinutesFromD,
  type SleepInput,
} from './sleep'

const base: SleepInput = { sleepDate: '2026-10-19', bedTime: null, wakeTime: null, naps: [] }

describe('BR-05 잠든 시각에 날짜 붙이기 (경계값)', () => {
  it.each([
    ['23:59', '2026-10-19T23:59'],
    ['00:00', '2026-10-20T00:00'],
    ['11:59', '2026-10-20T11:59'],
    ['12:00', '2026-10-19T12:00'],
  ])('잠든 시각 %s → %s', (bedTime, expected) => {
    expect(calculateSleep({ ...base, bedTime }).bedAt).toBe(expected)
  })

  it('분 단위 값', () => {
    expect(bedMinutesFromD('21:30')).toBe(21 * 60 + 30)
    expect(bedMinutesFromD('00:30')).toBe(24 * 60 + 30)
  })
})

describe('BR-05 일어난 시각에 날짜 붙이기', () => {
  it('잠든 시각 이후 처음 오는 그 시각', () => {
    const r = calculateSleep({ ...base, bedTime: '21:30', wakeTime: '07:10' })
    expect(r.wakeAt).toBe('2026-10-20T07:10')
  })

  it('자정 넘어 잠들어도 다음 날 아침', () => {
    const r = calculateSleep({ ...base, bedTime: '00:40', wakeTime: '08:00' })
    expect([r.bedAt, r.wakeAt]).toEqual(['2026-10-20T00:40', '2026-10-20T08:00'])
  })

  it('잠든 시각이 없으면 수면일 정오 이후 처음 오는 시각', () => {
    expect(wakeMinutesFromD('07:10', null)).toBe(24 * 60 + 7 * 60 + 10)
  })

  it('월말에서 다음 달로 넘어간다', () => {
    const r = calculateSleep({
      sleepDate: '2026-10-31',
      bedTime: '22:00',
      wakeTime: '06:30',
      naps: [],
    })
    expect(r.wakeAt).toBe('2026-11-01T06:30')
  })
})

describe('BR-07 총 수면 시간', () => {
  it('시안 예시: 밤잠 9시간 40분 + 낮잠 2시간 30분 = 12시간 10분', () => {
    const r = calculateSleep({
      ...base,
      bedTime: '21:30',
      wakeTime: '07:10',
      naps: [
        { start: '10:00', end: '11:20' },
        { start: '14:30', end: '15:40' },
      ],
    })
    expect(r.errors).toEqual([])
    expect([r.nightMinutes, r.napMinutes, r.totalMinutes]).toEqual([580, 150, 730])
    expect(formatNightSleep(r)).toBe('9시간 40분')
    expect(formatNapSleep(r)).toBe('2회 · 2시간 30분')
    expect(formatTotalSleep(r.totalMinutes)).toBe('12시간 10분')
  })

  it('잠든·일어난 시각 중 하나만 있으면 밤잠과 총 수면은 계산하지 않는다 (FR-SLEEP-06)', () => {
    const r = calculateSleep({
      ...base,
      wakeTime: '07:10',
      naps: [{ start: '13:00', end: '14:00' }],
    })
    expect([r.nightMinutes, r.napMinutes, r.totalMinutes]).toEqual([null, 60, null])
    expect(r.errors).toEqual([])
    expect(formatNightSleep(r)).toBe('계산 불가')
    expect(formatTotalSleep(r.totalMinutes)).toBe('계산 불가')
  })

  it('낮잠이 없으면 낮잠은 없음이다', () => {
    const r = calculateSleep({ ...base, bedTime: '21:00', wakeTime: '07:00' })
    expect(formatNapSleep(r)).toBe('없음')
  })

  it('잠든·일어난 시각이 둘 다 없으면 총 수면은 낮잠 합계다', () => {
    const r = calculateSleep({ ...base, naps: [{ start: '13:00', end: '14:30' }] })
    expect([r.nightMinutes, r.totalMinutes]).toEqual([null, 90])
    expect(formatNightSleep(r)).toBe('없음')
    expect(formatTotalSleep(r.totalMinutes)).toBe('1시간 30분')
  })

  it('빈 낮잠 줄은 무시한다', () => {
    const r = calculateSleep({
      ...base,
      bedTime: '21:00',
      wakeTime: '07:00',
      naps: [{ start: null, end: null }],
    })
    expect(r.naps).toEqual([])
    expect(r.errors).toEqual([])
  })
})

describe('FR-SLEEP-07 오류', () => {
  const codes = (input: Partial<SleepInput>) =>
    calculateSleep({ ...base, ...input }).errors.map((e) => e.code)

  it('아무것도 입력하지 않으면 오류', () => {
    expect(codes({})).toEqual(['EMPTY'])
  })

  it('밤잠 1시간 미만 / 16시간 초과', () => {
    expect(codes({ bedTime: '21:00', wakeTime: '21:30' })).toEqual(['NIGHT_OUT_OF_RANGE'])
    expect(codes({ bedTime: '13:00', wakeTime: '05:30' })).toEqual(['NIGHT_OUT_OF_RANGE'])
  })

  it('밤잠 경계값: 1시간과 16시간은 허용', () => {
    expect(codes({ bedTime: '21:00', wakeTime: '22:00' })).toEqual([])
    expect(codes({ bedTime: '18:00', wakeTime: '10:00' })).toEqual([])
  })

  it('낮잠 끝이 시작보다 이르거나 같으면 오류', () => {
    expect(codes({ naps: [{ start: '14:00', end: '13:00' }] })).toEqual(['NAP_END_NOT_AFTER_START'])
    expect(codes({ naps: [{ start: '14:00', end: '14:00' }] })).toEqual(['NAP_END_NOT_AFTER_START'])
  })

  it('낮잠 시작이나 끝 하나만 있으면 오류', () => {
    expect(codes({ naps: [{ start: '14:00', end: null }] })).toEqual(['NAP_INCOMPLETE'])
  })

  it('낮잠끼리 겹치면 오류, 맞닿기만 하면 허용', () => {
    expect(
      codes({
        naps: [
          { start: '10:00', end: '11:00' },
          { start: '10:30', end: '11:30' },
        ],
      }),
    ).toEqual(['NAPS_OVERLAP'])
    expect(
      codes({
        naps: [
          { start: '10:00', end: '11:00' },
          { start: '11:00', end: '12:00' },
        ],
      }),
    ).toEqual([])
  })

  it('낮잠이 밤잠과 겹치면 오류', () => {
    expect(
      codes({ bedTime: '19:00', wakeTime: '07:00', naps: [{ start: '18:30', end: '19:30' }] }),
    ).toEqual(['NAP_OVERLAPS_NIGHT'])
  })

  it('오류 문구는 숫자에 따라 조사가 틀리지 않게 쓴다', () => {
    expect(sleepErrorMessage({ code: 'NAPS_OVERLAP', index: 0, other: 1 })).toBe(
      '낮잠 1, 낮잠 2: 시간이 서로 겹쳐요',
    )
    expect(sleepErrorMessage({ code: 'NAP_OVERLAPS_NIGHT', index: 1 })).toBe(
      '낮잠 2: 밤잠 시간과 겹쳐요',
    )
  })
})

describe('형식', () => {
  it('formatDuration', () => {
    expect(formatDuration(45)).toBe('45분')
    expect(formatDuration(120)).toBe('2시간')
    expect(formatDuration(610)).toBe('10시간 10분')
  })

  it('잘못된 시각 형식은 오류', () => {
    expect(() => parseTime('7:10')).toThrow(RangeError)
    expect(() => parseTime('24:00')).toThrow(RangeError)
  })
})
