import type { PostgrestError } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dateErrorReason, violatedCheck } from './dbErrors'

// DB 검증 실패 분류 (FR-COM-13). 오늘은 2026-10-22
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 22, 9, 0))
})
afterEach(() => vi.useRealTimers())

function pgError(code: string, message = ''): PostgrestError {
  return { code, message, details: '', hint: '', name: 'PostgrestError' } as PostgrestError
}

describe('dateErrorReason', () => {
  it('22007이면 날짜를 보고 오늘 이후인지 생년월일 이전인지 나눈다', () => {
    expect(dateErrorReason(pgError('22007'), '2026-10-23')).toBe('futureDate')
    expect(dateErrorReason(pgError('22007'), '2026-01-07')).toBe('beforeBirth')
  })

  it('다른 오류는 null', () => {
    expect(dateErrorReason(pgError('23514'), '2026-10-23')).toBeNull()
  })
})

describe('violatedCheck', () => {
  const names = ['milestones_title_length', 'milestones_memo_length'] as const

  it('23514 오류 문구에서 제약 이름을 찾는다', () => {
    const error = pgError(
      '23514',
      'new row for relation "milestones" violates check constraint "milestones_memo_length"',
    )
    expect(violatedCheck(error, names)).toBe('milestones_memo_length')
  })

  it('모르는 제약이거나 다른 오류면 undefined', () => {
    expect(violatedCheck(pgError('23514', 'violates check constraint "other"'), names)).toBe(
      undefined,
    )
    expect(violatedCheck(pgError('23505', 'milestones_title_length'), names)).toBeUndefined()
  })
})
