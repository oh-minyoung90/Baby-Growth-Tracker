import { describe, expect, it } from 'vitest'
import { parseDate } from '@/domain/date'
import type { BodyMeasure } from './bodyApi'
import { chartPoints, periodStart, timeDomain, timeTicks, valueDomain } from './bodyChartData'

// 키·몸무게 차트 계산 (FR-BODY-03~04, FR-COM-21)

function measure(values: Partial<BodyMeasure> & Pick<BodyMeasure, 'id' | 'date'>): BodyMeasure {
  return { heightCm: null, weightKg: null, memo: null, ...values }
}

const time = (date: string) => parseDate(date).getTime()

describe('periodStart', () => {
  it('전체는 시작 날짜가 없다', () => {
    expect(periodStart('all', '2026-10-22')).toBeNull()
  })

  it('최근 6개월·3개월은 오늘에서 개월 수를 뺀 날부터다', () => {
    expect(periodStart('6m', '2026-10-22')).toBe('2026-04-22')
    expect(periodStart('3m', '2026-10-22')).toBe('2026-07-22')
  })

  it('그 달에 같은 날짜가 없으면 말일부터다', () => {
    expect(periodStart('3m', '2026-05-31')).toBe('2026-02-28')
  })
})

describe('chartPoints', () => {
  const measures = [
    measure({ id: 'c', date: '2026-09-30', heightCm: 72.1, weightKg: 8.9 }),
    measure({ id: 'b', date: '2026-07-21', weightKg: 8.2 }),
    measure({ id: 'a', date: '2026-07-22', heightCm: 68 }),
  ]

  it('값이 있는 기록만 날짜 오래된 순으로 만든다', () => {
    expect(chartPoints(measures, 'heightCm', null)).toEqual([
      { id: 'a', date: '2026-07-22', time: time('2026-07-22'), value: 68 },
      { id: 'c', date: '2026-09-30', time: time('2026-09-30'), value: 72.1 },
    ])
    expect(chartPoints(measures, 'weightKg', null).map((point) => point.id)).toEqual(['b', 'c'])
  })

  it('기간 첫날은 포함하고, 그 전 기록은 뺀다', () => {
    expect(chartPoints(measures, 'heightCm', '2026-07-22').map((point) => point.id)).toEqual([
      'a',
      'c',
    ])
    expect(chartPoints(measures, 'weightKg', '2026-07-22').map((point) => point.id)).toEqual(['c'])
  })

  it('기록이 없으면 빈 목록이다', () => {
    expect(chartPoints([], 'heightCm', null)).toEqual([])
  })
})

describe('축 범위', () => {
  const point = (date: string, value: number) => ({ id: date, date, time: time(date), value })

  it('세로축은 정수로 내림·올림한다', () => {
    expect(valueDomain([point('2026-01-08', 50), point('2026-09-30', 72.1)])).toEqual([50, 73])
  })

  it('값이 하나뿐이거나 모두 같으면 위아래로 1씩 넓힌다', () => {
    expect(valueDomain([point('2026-09-30', 72)])).toEqual([71, 73])
    expect(valueDomain([point('2026-09-01', 8.4), point('2026-09-30', 8.4)])).toEqual([8, 9])
  })

  it('가로축은 첫 측정부터 마지막 측정까지이고, 눈금은 양 끝 날짜다', () => {
    const points = [point('2026-01-08', 50), point('2026-09-30', 72.1)]
    expect(timeDomain(points)).toEqual([time('2026-01-08'), time('2026-09-30')])
    expect(timeTicks(points)).toEqual([time('2026-01-08'), time('2026-09-30')])
  })

  it('점이 하나면 가운데 오도록 앞뒤로 15일씩 넓힌다 (FR-COM-21)', () => {
    const points = [point('2026-09-30', 72.1)]
    expect(timeDomain(points)).toEqual([time('2026-09-15'), time('2026-10-15')])
    expect(timeTicks(points)).toEqual([time('2026-09-30')])
  })
})
