import { describe, expect, it } from 'vitest'
import { mealWeek, shiftMealWeek, weekFromParam } from './mealWeek'

describe('월요일 시작 주간 식단 (FR-MEAL-01)', () => {
  it('일요일도 직전 월요일부터 7일을 보여 준다', () => {
    expect(mealWeek('2026-11-15').days).toEqual([
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
      '2026-11-15',
    ])
  })
  it('월·연도를 넘는 주에도 정확한 기간을 표시한다', () => {
    expect(mealWeek('2027-01-01')).toMatchObject({
      start: '2026-12-28',
      end: '2027-01-03',
      label: '2026년 12월 28일 ~ 2027년 1월 3일',
    })
    expect(mealWeek('2026-11-01').label).toBe('2026년 10월 26일 ~ 11월 1일')
  })
  it('윤년과 이전·다음 주를 날짜 단위로 계산한다', () => {
    expect(mealWeek('2028-02-29').days).toContain('2028-02-29')
    expect(shiftMealWeek('2026-12-28', 1)).toBe('2027-01-04')
    expect(shiftMealWeek('2027-01-04', -1)).toBe('2026-12-28')
  })
  it('잘못된 주소 날짜는 오늘이 포함된 주로 돌아간다', () => {
    expect(weekFromParam('2026-02-30', '2026-11-11').start).toBe('2026-11-09')
    expect(weekFromParam('invalid', '2026-11-11').start).toBe('2026-11-09')
  })
})
