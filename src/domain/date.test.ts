import { describe, expect, it } from 'vitest'
import { formatDateLabel, todayString } from './date'

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
