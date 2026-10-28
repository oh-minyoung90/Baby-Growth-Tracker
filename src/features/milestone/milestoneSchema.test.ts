import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { milestoneSchema, serverFieldError, type MilestoneFormValues } from './milestoneSchema'

// 발달 기록 입력 검증 (FR-MS-02, FR-COM-10~12). 오늘은 2026-10-22, 생년월일은 2026-01-08
const BIRTH = '2026-01-08'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 22, 9, 0))
})
afterEach(() => vi.useRealTimers())

function parse(values: Partial<MilestoneFormValues>) {
  return milestoneSchema(BIRTH).safeParse({
    type: 'behavior',
    date: '2026-10-20',
    title: '잡고 서기',
    memo: '',
    ...values,
  })
}

function messages(values: Partial<MilestoneFormValues>) {
  const result = parse(values)
  return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

describe('milestoneSchema', () => {
  it('앞뒤 공백을 지우고, 비어 있는 메모는 null로 저장한다', () => {
    expect(parse({ title: '  잡고 서기 ', memo: '  ' }).data).toEqual({
      type: 'behavior',
      date: '2026-10-20',
      title: '잡고 서기',
      memo: null,
    })
  })

  it('유형을 고르지 않으면 안내한다', () => {
    expect(messages({ type: '' })).toEqual(['유형을 골라 주세요'])
  })

  it('내용이 비었거나 공백뿐이면 안내한다', () => {
    expect(messages({ title: '   ' })).toEqual(['내용을 입력해 주세요'])
  })

  it('내용은 30자, 메모는 500자까지다', () => {
    expect(parse({ title: '가'.repeat(30) }).success).toBe(true)
    expect(messages({ title: '가'.repeat(31) })).toEqual(['30자까지 입력할 수 있어요'])
    expect(messages({ memo: '가'.repeat(501) })).toEqual(['500자까지 입력할 수 있어요'])
  })

  it('비어 있는 칸을 한 번에 모두 안내한다', () => {
    expect(messages({ type: '', date: '', title: '' })).toEqual([
      '유형을 골라 주세요',
      '날짜를 선택해 주세요',
      '내용을 입력해 주세요',
    ])
  })

  it('오늘 이후와 생년월일 이전 날짜는 받지 않는다', () => {
    expect(messages({ date: '2026-10-23' })).toEqual(['오늘 이후 날짜는 고를 수 없어요'])
    expect(messages({ date: '2026-01-07' })).toEqual(['생년월일 이전 날짜는 고를 수 없어요'])
  })
})

describe('서버 검증 실패 (FR-COM-13)', () => {
  it('화면 검증과 같은 칸·문구로 바꾼다', () => {
    expect(serverFieldError('futureDate')).toEqual({
      field: 'date',
      message: '오늘 이후 날짜는 고를 수 없어요',
    })
    expect(serverFieldError('beforeBirth')?.field).toBe('date')
    expect(serverFieldError('titleLength')).toEqual({
      field: 'title',
      message: '30자까지 입력할 수 있어요',
    })
    expect(serverFieldError('memoLength')?.field).toBe('memo')
    expect(serverFieldError('duplicateWord')).toEqual({
      field: 'title',
      message: '이미 말한 단어예요',
    })
    expect(serverFieldError('network')).toBeNull()
  })
})
