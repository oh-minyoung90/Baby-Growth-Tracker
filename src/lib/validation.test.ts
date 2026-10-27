import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DATE_MESSAGES, optionalText, recordDate, requiredText } from './validation'

// 입력 검증 규칙 (기능요구사항서 FR-COM-02~04, 10~12)

function firstError(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.success ? null : result.error?.issues[0].message
}

describe('requiredText', () => {
  const schema = requiredText(5, '내용을 입력해 주세요')

  it('앞뒤 공백을 지운다', () => {
    expect(schema.parse('  잡고서기 ')).toBe('잡고서기')
  })

  it('비어 있거나 공백만 있으면 안내한다', () => {
    expect(firstError(schema.safeParse(''))).toBe('내용을 입력해 주세요')
    expect(firstError(schema.safeParse('   '))).toBe('내용을 입력해 주세요')
  })

  it('최대 글자 수를 넘으면 안내한다 (공백 제거 후 기준)', () => {
    expect(schema.parse(' 12345 ')).toBe('12345')
    expect(firstError(schema.safeParse('123456'))).toBe('5자까지 입력할 수 있어요')
  })
})

describe('optionalText', () => {
  const schema = optionalText(500)

  it('비어 있거나 공백만 있으면 null로 저장한다', () => {
    expect(schema.parse('')).toBeNull()
    expect(schema.parse('  ')).toBeNull()
  })

  it('앞뒤 공백을 지운다', () => {
    expect(schema.parse(' 메모 ')).toBe('메모')
  })

  it('최대 글자 수를 넘으면 안내한다', () => {
    expect(firstError(schema.safeParse('가'.repeat(501)))).toBe('500자까지 입력할 수 있어요')
  })
})

describe('recordDate', () => {
  // 오늘을 2026-10-22로 고정한다 (Date만 바꾸고 타이머는 그대로 둔다)
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 22, 9, 0))
  })
  afterEach(() => vi.useRealTimers())

  it('오늘과 과거 날짜는 받는다', () => {
    expect(recordDate().parse('2026-10-22')).toBe('2026-10-22')
    expect(recordDate().parse('2025-01-01')).toBe('2025-01-01')
  })

  it('비어 있거나 형식이 틀리면 안내한다', () => {
    expect(firstError(recordDate().safeParse(''))).toBe(DATE_MESSAGES.required)
    expect(firstError(recordDate().safeParse('2026-02-30'))).toBe(DATE_MESSAGES.invalid)
  })

  it('오늘 이후 날짜는 받지 않는다 (FR-COM-03)', () => {
    expect(firstError(recordDate().safeParse('2026-10-23'))).toBe(DATE_MESSAGES.future)
  })

  it('주간 식단처럼 미래를 허용하면 받는다', () => {
    expect(recordDate({ allowFuture: true }).parse('2026-11-01')).toBe('2026-11-01')
  })

  it('생년월일 이전 날짜는 받지 않는다 (FR-COM-04)', () => {
    const schema = recordDate({ birthDate: '2026-01-08' })
    expect(schema.parse('2026-01-08')).toBe('2026-01-08')
    expect(firstError(schema.safeParse('2026-01-07'))).toBe(DATE_MESSAGES.beforeBirth)
  })
})
