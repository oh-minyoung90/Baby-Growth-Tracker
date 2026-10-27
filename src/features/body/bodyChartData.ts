import { addDays, subMonths } from 'date-fns'
import { parseDate, todayString } from '@/domain/date'
import type { BodyMeasure } from './bodyApi'

/** 키·몸무게 차트 계산 (FR-BODY-03~04, FR-COM-21). 화면과 무관한 순수 함수 */

export type ChartPeriod = 'all' | '6m' | '3m'

export const CHART_PERIODS: { value: ChartPeriod; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: '6m', label: '최근 6개월' },
  { value: '3m', label: '최근 3개월' },
]

/** 기간의 첫날 'YYYY-MM-DD' (그날 포함). 전체는 null. 10월 22일 기준 최근 3개월은 7월 22일부터 */
export function periodStart(period: ChartPeriod, today: string): string | null {
  if (period === 'all') return null
  return todayString(subMonths(parseDate(today), period === '6m' ? 6 : 3))
}

export interface ChartPoint {
  id: string
  /** 'YYYY-MM-DD' */
  date: string
  /** 가로축 위치: 그날 0시의 시각(ms). 측정 간격만큼 떨어져 그려진다 */
  time: number
  value: number
}

/** 차트에 그릴 점: 값이 있는 기록만, 기간 안의 것만, 날짜 오래된 순 */
export function chartPoints(
  measures: BodyMeasure[],
  metric: 'heightCm' | 'weightKg',
  start: string | null,
): ChartPoint[] {
  return measures
    .flatMap((measure) => {
      const value = measure[metric]
      if (value === null || (start && measure.date < start)) return []
      return [
        { id: measure.id, date: measure.date, time: parseDate(measure.date).getTime(), value },
      ]
    })
    .sort((a, b) => a.time - b.time)
}

/** 세로축 범위: 정수로 내림·올림. 값이 하나뿐이거나 모두 같으면 위아래로 1씩 넓힌다 */
export function valueDomain(points: ChartPoint[]): [number, number] {
  const values = points.map((point) => point.value)
  const min = Math.floor(Math.min(...values))
  const max = Math.ceil(Math.max(...values))
  return min === max ? [min - 1, max + 1] : [min, max]
}

/** 가로축 범위: 첫 측정~마지막 측정. 점이 하나면 가운데 오도록 앞뒤로 15일씩 넓힌다 (FR-COM-21) */
export function timeDomain(points: ChartPoint[]): [number, number] {
  const first = points[0].time
  const last = points[points.length - 1].time
  if (first !== last) return [first, last]
  const date = new Date(first)
  return [addDays(date, -15).getTime(), addDays(date, 15).getTime()]
}

/** 가로축 눈금: 첫 측정과 마지막 측정 날짜 */
export function timeTicks(points: ChartPoint[]): number[] {
  const first = points[0].time
  const last = points[points.length - 1].time
  return first === last ? [first] : [first, last]
}
