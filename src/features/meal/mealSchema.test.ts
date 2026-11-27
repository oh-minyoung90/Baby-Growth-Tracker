import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getMealStatus } from '@/lib/mealTypes'
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
  status: 'eaten' as const,
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
  it('기기의 오늘 이후에는 예정만 허용한다', () => {
    for (const status of ['eaten', 'good', 'refused'] as const)
      expect(mealSchema().safeParse({ ...values, status, date: '2026-11-12' }).success).toBe(false)
    expect(
      mealSchema().safeParse({ ...values, date: '2026-11-12', status: 'planned' }).success,
    ).toBe(true)
  })
  it('잘못된 날짜와 생년월일 이전 날짜는 거부한다', () => {
    expect(mealSchema().safeParse({ ...values, date: '2026-02-30' }).success).toBe(false)
    expect(mealSchema('2026-01-08').safeParse({ ...values, date: '2026-01-07' }).success).toBe(
      false,
    )
  })
  it('먹음과 빈 메모는 별도 반응·메모를 기록하지 않고, 삭제된 음식 이름은 그대로 보존한다', () => {
    expect(
      mealSchema().parse({ ...values, foods: [{ id: null, name: ' 쌀 ' }], memo: '   ' }),
    ).toMatchObject({ foods: [{ id: null, name: '쌀' }], intake: null, memo: null })
  })
  it.each([
    ['planned', false, null],
    ['good', true, 'good'],
    ['eaten', true, null],
    ['refused', false, 'refuse'],
  ] as const)('%s 식사 상태를 섭취 여부와 반응으로 저장한다', (status, eaten, intake) => {
    expect(mealSchema().parse({ ...values, status })).toMatchObject({ eaten, intake })
  })
  it('이전 기록은 저장된 실제 섭취 체크를 우선하여 표시한다', () => {
    expect(getMealStatus({ eaten: true, intake: 'refuse' })).toBe('eaten')
    expect(getMealStatus({ eaten: false, intake: 'good' })).toBe('planned')
    expect(getMealStatus({ eaten: false, intake: 'refuse' })).toBe('refused')
  })
  it('메모는 500자까지 허용한다', () => {
    expect(mealSchema().safeParse({ ...values, memo: '가'.repeat(500) }).success).toBe(true)
    expect(mealSchema().safeParse({ ...values, memo: '가'.repeat(501) }).success).toBe(false)
  })
})
