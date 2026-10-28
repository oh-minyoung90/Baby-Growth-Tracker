import { describe, expect, it } from 'vitest'
import {
  formatDateLabel,
  formatDateTimeLabel,
  isValidDateString,
  todayString,
  yesterdayString,
} from './date'

describe('todayString', () => {
  it('기기 시간대의 날짜를 YYYY-MM-DD로 만든다', () => {
    expect(todayString(new Date(2026, 9, 22, 23, 59))).toBe('2026-10-22')
    expect(todayString(new Date(2026, 0, 8, 0, 0))).toBe('2026-01-08')
  })
})

describe('formatDateLabel (FR-COM-05)', () => {
  it('YYYY. M. D. (요일) 형식', () => {
    expect(formatDateLabel('2026-01-08')).toBe('2026. 1. 8. (목)')
    expect(formatDateLabel('2026-10-20')).toBe('2026. 10. 20. (화)')
  })
})

describe('isValidDateString', () => {
  it('YYYY-MM-DD 형식의 실제 날짜만 받는다', () => {
    expect(isValidDateString('2026-02-28')).toBe(true)
    expect(isValidDateString('2028-02-29')).toBe(true)
    expect(isValidDateString('2026-02-29')).toBe(false)
    expect(isValidDateString('2026-2-8')).toBe(false)
    expect(isValidDateString('')).toBe(false)
  })
})

describe('yesterdayString', () => {
  it('기기 시간대의 어제 날짜. 월·연도가 바뀌는 날도 맞다', () => {
    expect(yesterdayString(new Date(2026, 9, 22, 0, 5))).toBe('2026-10-21')
    expect(yesterdayString(new Date(2026, 0, 1, 9, 0))).toBe('2025-12-31')
  })
})

describe('formatDateTimeLabel (FR-SLEEP-03)', () => {
  it('M. D. (요일) HH:MM 형식', () => {
    expect(formatDateTimeLabel('2026-10-19T21:30')).toBe('10. 19. (월) 21:30')
    expect(formatDateTimeLabel('2026-10-20T07:05')).toBe('10. 20. (화) 07:05')
  })
})
