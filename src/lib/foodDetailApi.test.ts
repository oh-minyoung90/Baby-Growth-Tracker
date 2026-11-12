import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchFood, setFoodPreference } from './foodApi'
import { fetchFoodEatenMeals, fetchFoodMealCounts, fetchFoodStatusHistory } from './foodDetailApi'
const mock = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  rows: [] as unknown[],
  error: null as null | Error,
}))
vi.mock('./supabase', () => ({ supabase: { from: mock.from, rpc: mock.rpc } }))
const chain = {
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  range: vi.fn(),
  update: vi.fn(),
  maybeSingle: vi.fn(),
}
beforeEach(() => {
  vi.resetAllMocks()
  mock.rows = []
  mock.error = null
  mock.from.mockReturnValue(chain)
  for (const key of ['select', 'eq', 'order', 'update'] as const) chain[key].mockReturnValue(chain)
  chain.range.mockImplementation(async () => ({ data: mock.rows, error: mock.error }))
  chain.maybeSingle.mockImplementation(async () => ({
    data: mock.rows[0] ?? null,
    error: mock.error,
  }))
  mock.rpc.mockResolvedValue({ data: [{ food_id: 'f1', eaten_count: 1234 }], error: null })
})
const row = {
  id: 'f1',
  name: '쌀',
  food_group: 'grain',
  status: 'tried',
  caution_tag: false,
  first_tried_date: null,
  manual_tried: true,
  manual_first_tried_date: null,
  preference: 'like',
  memo: '유지할 메모',
  reaction_date: null,
  symptom_note: null,
  check_note: null,
}

describe('음식 상세 API', () => {
  it('먹음 횟수는 집계 RPC 결과로 받고 1,000건보다 큰 값도 보존한다', async () => {
    expect(await fetchFoodMealCounts()).toEqual({ f1: 1234 })
    expect(mock.rpc).toHaveBeenCalledExactlyOnceWith('food_meal_counts')
  })
  it('먹음 식단은 직접 음식 ID로 제한하고 최신순·20개씩 다음 페이지를 조회한다', async () => {
    mock.rows = Array.from({ length: 21 }, (_, i) => ({
      id: `m${i}`,
      date: '2026-11-11',
      meal_type: 'lunch',
      intake: 'good',
    }))
    const first = await fetchFoodEatenMeals('f1')
    expect(first.items).toHaveLength(20)
    expect(first.nextOffset).toBe(20)
    expect(chain.select).toHaveBeenCalledWith(expect.stringContaining('meal_entry_foods!inner'))
    expect(chain.eq).toHaveBeenCalledWith('eaten', true)
    expect(chain.eq).toHaveBeenCalledWith('meal_entry_foods.food_id', 'f1')
    expect(chain.order).toHaveBeenCalledWith('date', { ascending: false })
    expect(chain.range).toHaveBeenCalledWith(0, 20)
    mock.rows = [{ id: 'm21', date: '2026-11-10', meal_type: 'snack', intake: null }]
    expect(await fetchFoodEatenMeals('f1', 20)).toEqual({
      items: [{ id: 'm21', date: '2026-11-10', type: 'snack', intake: null }],
      nextOffset: undefined,
    })
    expect(chain.range).toHaveBeenLastCalledWith(20, 40)
  })
  it('이력은 해당 음식의 저장된 사유와 알러지 정보까지 최신순으로 읽는다', async () => {
    mock.rows = [
      {
        id: 'h1',
        changed_at: '2026-11-11T01:00:00Z',
        from_status: 'caution',
        to_status: 'tried',
        trigger: 'manual',
        caution_tag: false,
        reason: '확인',
        reaction_date: '2026-10-01',
        symptom_note: '증상',
        check_note: '진료',
        meal_entry_id: null,
      },
    ]
    expect((await fetchFoodStatusHistory('f1')).items).toEqual(mock.rows)
    expect(mock.from).toHaveBeenCalledWith('food_status_history')
    expect(chain.eq).toHaveBeenCalledWith('food_id', 'f1')
    expect(chain.order).toHaveBeenCalledWith('changed_at', { ascending: false })
  })
  it('단건 조회의 없는 음식은 null이고 반응 수정은 해당 필드만 보낸다', async () => {
    expect(await fetchFood('missing')).toBeNull()
    mock.rows = [row]
    expect(await setFoodPreference('f1', null)).toMatchObject({ id: 'f1', memo: '유지할 메모' })
    expect(chain.update).toHaveBeenCalledExactlyOnceWith({ preference: null })
    expect(chain.eq).toHaveBeenCalledWith('status', 'tried')
    expect(chain.eq).toHaveBeenCalledWith('id', 'f1')
  })
  it('상태가 바뀐 음식과 조회·집계 통신 오류는 성공으로 처리하지 않는다', async () => {
    await expect(setFoodPreference('f1', 'love')).rejects.toThrow('음식 상태가 바뀌었거나')
    mock.error = new Error('network')
    await expect(fetchFoodEatenMeals('f1')).rejects.toThrow('network')
    await expect(fetchFoodStatusHistory('f1')).rejects.toThrow('network')
    mock.rpc.mockResolvedValueOnce({ data: null, error: new Error('network') })
    await expect(fetchFoodMealCounts()).rejects.toThrow('network')
  })
})
