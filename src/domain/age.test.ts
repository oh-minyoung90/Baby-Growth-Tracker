import { describe, expect, it } from 'vitest'
import { ageLabel, calculateAge, formatAge } from './age'
import { parseDate } from './date'

describe('calculateAge: 기능요구사항서 3.2 예시 표', () => {
  it.each([
    ['2026-01-15', '2026-01-15', '생후 0일'],
    ['2026-01-15', '2026-03-20', '생후 2개월 5일'],
    ['2026-01-31', '2026-02-28', '생후 1개월 0일'],
    ['2026-01-31', '2026-03-01', '생후 1개월 1일'],
    ['2026-01-31', '2026-03-31', '생후 2개월 0일'],
  ])('%s 출생, %s 기록 → %s', (birth, record, expected) => {
    expect(formatAge(calculateAge(birth, record))).toBe(expected)
  })
})

describe('calculateAge: 경계값', () => {
  it('생일 하루 전까지는 개월 수가 늘지 않는다', () => {
    expect(calculateAge('2026-01-08', '2026-02-07')).toEqual({ months: 0, days: 30 })
    expect(calculateAge('2026-01-08', '2026-02-08')).toEqual({ months: 1, days: 0 })
  })

  it('해가 바뀌어도 이어서 센다', () => {
    expect(calculateAge('2025-12-20', '2026-01-19')).toEqual({ months: 0, days: 30 })
    expect(calculateAge('2025-12-20', '2026-01-20')).toEqual({ months: 1, days: 0 })
  })

  it('1년이 지나면 12개월로 표시한다', () => {
    expect(formatAge(calculateAge('2026-01-08', '2027-01-08'))).toBe('생후 12개월 0일')
  })

  it('윤년 2월 29일생은 평년 2월 28일에 개월이 찬다', () => {
    expect(calculateAge('2024-02-29', '2025-02-28')).toEqual({ months: 12, days: 0 })
    expect(calculateAge('2024-02-29', '2024-03-29')).toEqual({ months: 1, days: 0 })
  })

  it('30일까지 있는 달의 말일 생일', () => {
    // 4월 30일생 → 5월 30일이 1개월, 5월 31일은 1개월 1일
    expect(calculateAge('2026-04-30', '2026-05-30')).toEqual({ months: 1, days: 0 })
    expect(calculateAge('2026-04-30', '2026-05-31')).toEqual({ months: 1, days: 1 })
  })
})

describe('calculateAge: 잘못된 입력', () => {
  it('기록 날짜가 생년월일보다 이르면 오류', () => {
    expect(() => calculateAge('2026-01-08', '2026-01-07')).toThrow(RangeError)
  })

  it('날짜 형식이 틀리면 오류', () => {
    expect(() => calculateAge('2026-1-8', '2026-02-01')).toThrow(RangeError)
  })

  it('존재하지 않는 날짜면 오류', () => {
    expect(() => calculateAge('2026-02-30', '2026-03-01')).toThrow(RangeError)
  })
})

describe('parseDate', () => {
  it('기기 시간대의 그날 0시로 만든다 (UTC로 해석하지 않는다)', () => {
    const d = parseDate('2026-01-08')
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 0, 8, 0])
  })
})

describe('ageLabel', () => {
  it('기록 날짜의 생후 일수 문구', () => {
    expect(ageLabel('2026-01-08', '2026-10-22')).toBe('생후 9개월 14일')
    expect(ageLabel('2026-01-08', '2026-01-08')).toBe('생후 0일')
  })

  it('생년월일이 없거나 기록 날짜가 더 이르면 null', () => {
    expect(ageLabel(undefined, '2026-10-22')).toBeNull()
    expect(ageLabel('2026-01-08', '2026-01-07')).toBeNull()
  })
})
