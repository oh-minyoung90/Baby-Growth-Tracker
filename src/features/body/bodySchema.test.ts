import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BODY_MESSAGES,
  acceptDecimalInput,
  bodyMeasureSchema,
  serverFieldError,
  type BodyFormValues,
} from './bodySchema'

// 키·몸무게 입력 검증 (FR-BODY-01~02). 오늘은 2026-10-22로 고정한다
const BIRTH = '2026-01-08'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 22, 9, 0))
})
afterEach(() => vi.useRealTimers())

function parse(values: Partial<BodyFormValues>) {
  return bodyMeasureSchema(BIRTH).safeParse({
    date: '2026-10-20',
    heightCm: '',
    weightKg: '',
    memo: '',
    ...values,
  })
}

function messages(values: Partial<BodyFormValues>) {
  const result = parse(values)
  return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

describe('키·몸무게 값', () => {
  it.each(['30', '30.0', '72.5', '150'])('키 %s cm는 받는다', (heightCm) => {
    expect(parse({ heightCm }).success).toBe(true)
  })

  it.each(['29.9', '150.1', '0', '.', '72.55'])('키 %s cm는 받지 않는다', (heightCm) => {
    expect(messages({ heightCm })).toEqual([BODY_MESSAGES.height])
  })

  it.each(['1', '50', '8.9'])('몸무게 %s kg는 받는다', (weightKg) => {
    expect(parse({ weightKg }).success).toBe(true)
  })

  it.each(['0.9', '50.1'])('몸무게 %s kg는 받지 않는다', (weightKg) => {
    expect(messages({ weightKg })).toEqual([BODY_MESSAGES.weight])
  })

  it('숫자로 바꾸고, 비어 있는 쪽은 null로 저장한다', () => {
    const result = parse({ heightCm: ' 72.5 ', weightKg: '', memo: '  영유아 검진 ' })
    expect(result.data).toEqual({
      date: '2026-10-20',
      heightCm: 72.5,
      weightKg: null,
      memo: '영유아 검진',
    })
  })

  it('끝이 소수점이면 정수로 본다', () => {
    expect(parse({ weightKg: '9.' }).data?.weightKg).toBe(9)
  })

  it('키와 몸무게가 모두 비면 하나 이상 입력하라고 안내한다', () => {
    const result = parse({ heightCm: '  ', weightKg: '' })
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ path: ['heightCm'], message: BODY_MESSAGES.heightOrWeight }),
    ])
  })

  it('날짜가 비어 있어도 다른 칸의 안내를 함께 보여 준다', () => {
    expect(messages({ date: '' })).toEqual(['날짜를 선택해 주세요', BODY_MESSAGES.heightOrWeight])
  })
})

describe('측정 날짜', () => {
  it('오늘 이후와 생년월일 이전은 받지 않는다', () => {
    expect(messages({ date: '2026-10-23', heightCm: '70' })).toEqual([
      '오늘 이후 날짜는 고를 수 없어요',
    ])
    expect(messages({ date: '2026-01-07', heightCm: '70' })).toEqual([
      '생년월일 이전 날짜는 고를 수 없어요',
    ])
  })

  it('오늘과 생년월일 당일은 받는다', () => {
    expect(parse({ date: '2026-10-22', heightCm: '70' }).success).toBe(true)
    expect(parse({ date: BIRTH, heightCm: '50' }).success).toBe(true)
  })
})

describe('숫자 칸 입력', () => {
  it.each([
    ['', '7', '7'],
    ['7', '72', '72'],
    ['72', '72.', '72.'],
    ['72.', '72.5', '72.5'],
    ['72.5', '72.55', '72.5'],
    ['72', '72a', '72'],
    ['150', '1500', '150'],
    ['8', '8,9', '8.9'],
    ['72.5', '', ''],
  ])('%j에 %j를 입력하면 %j', (previous, next, expected) => {
    expect(acceptDecimalInput(next, previous)).toBe(expected)
  })
})

describe('서버 검증 실패 (FR-COM-13)', () => {
  it('화면 검증과 같은 칸·문구로 바꾼다', () => {
    expect(serverFieldError('futureDate')).toEqual({
      field: 'date',
      message: '오늘 이후 날짜는 고를 수 없어요',
    })
    expect(serverFieldError('beforeBirth')?.message).toBe('생년월일 이전 날짜는 고를 수 없어요')
    expect(serverFieldError('duplicateDate')).toEqual({
      field: 'date',
      message: '같은 날짜에 측정 기록이 있어요',
    })
    expect(serverFieldError('heightRange')).toEqual({
      field: 'heightCm',
      message: BODY_MESSAGES.height,
    })
    expect(serverFieldError('weightRange')?.field).toBe('weightKg')
    expect(serverFieldError('heightOrWeight')?.message).toBe(BODY_MESSAGES.heightOrWeight)
    expect(serverFieldError('memoLength')).toEqual({
      field: 'memo',
      message: '500자까지 입력할 수 있어요',
    })
  })

  it('네트워크 오류는 입력칸이 아니라 상단 안내로 보여 준다', () => {
    expect(serverFieldError('network')).toBeNull()
  })
})
