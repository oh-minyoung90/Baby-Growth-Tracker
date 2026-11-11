import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mealSchema } from './mealSchema'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 11, 9))
})
afterEach(() => vi.useRealTimers())
const values = {
  date: '2026-11-11',
  foods: [{ id: 'f1', name: '쌀' }],
  recipes: [],
  eaten: true,
  intake: '',
  memo: '',
}
describe('식단 입력 검증 (FR-MEAL-05~07)', () => {
  it('음식·레시피 합계 1개 이상이 필요하고 레시피만 있어도 저장된다', () => {
    expect(mealSchema().safeParse({ ...values, foods: [] }).success).toBe(false)
    expect(
      mealSchema().safeParse({ ...values, foods: [], recipes: [{ id: 'r1', name: '채소죽' }] })
        .success,
    ).toBe(true)
  })
  it('기기의 오늘 이후 먹음은 거부하지만 미래 계획은 허용한다', () => {
    expect(mealSchema().safeParse({ ...values, date: '2026-11-12' }).success).toBe(false)
    expect(mealSchema().safeParse({ ...values, date: '2026-11-12', eaten: false }).success).toBe(
      true,
    )
  })
  it('잘못된 날짜와 생년월일 이전 날짜는 거부한다', () => {
    expect(mealSchema().safeParse({ ...values, date: '2026-02-30' }).success).toBe(false)
    expect(mealSchema('2026-01-08').safeParse({ ...values, date: '2026-01-07' }).success).toBe(
      false,
    )
  })
  it('선택 안 함·빈 메모는 null, 삭제된 음식 이름은 그대로 보존한다', () => {
    expect(
      mealSchema().parse({ ...values, foods: [{ id: null, name: ' 쌀 ' }], memo: '   ' }),
    ).toMatchObject({ foods: [{ id: null, name: '쌀' }], intake: null, memo: null })
  })
  it('메모는 500자까지 허용한다', () => {
    expect(mealSchema().safeParse({ ...values, memo: '가'.repeat(500) }).success).toBe(true)
    expect(mealSchema().safeParse({ ...values, memo: '가'.repeat(501) }).success).toBe(false)
  })
})
