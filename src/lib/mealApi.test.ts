import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deleteMealEntry,
  fetchMealEntry,
  fetchMealWeek,
  MealSaveError,
  saveMealEntry,
  setMealEaten,
  moveMealEntry,
  type MealInput,
} from './mealApi'

const mock = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  result: { data: [] as unknown[], error: null as null | { code: string; message: string } },
}))
vi.mock('./supabase', () => ({ supabase: { from: mock.from, rpc: mock.rpc } }))
const chain = {
  select: vi.fn(),
  gte: vi.fn(),
  lte: vi.fn(),
  order: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}
beforeEach(() => {
  vi.resetAllMocks()
  mock.result = { data: [], error: null }
  mock.from.mockReturnValue(chain)
  chain.select.mockReturnValue(chain)
  chain.gte.mockReturnValue(chain)
  chain.lte.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.order.mockImplementation(async () => mock.result)
  chain.maybeSingle.mockImplementation(async () => ({
    data: mock.result.data[0] ?? null,
    error: mock.result.error,
  }))
  mock.rpc.mockResolvedValue({
    data: { id: 'm1', first_tried_foods: [{ id: 'f1', name: '쌀' }] },
    error: null,
  })
})
const input: MealInput = {
  date: '2026-11-11',
  type: 'lunch',
  eaten: false,
  intake: null,
  memo: null,
  foods: [
    { id: 'f1', name: '쌀' },
    { id: null, name: '삭제된 음식' },
  ],
  recipes: [{ id: null, name: '채소죽' }],
}

describe('식단 API (T-42·T-43)', () => {
  it('주 날짜 범위를 제한하고 순서와 삭제된 이름을 복원한다', async () => {
    mock.result.data = [
      {
        id: 'm1',
        date: '2026-11-11',
        meal_type: 'lunch',
        eaten: true,
        intake: 'good',
        memo: null,
        meal_entry_foods: [
          { food_id: null, food_name: '보리', position: 1 },
          { food_id: 'f1', food_name: '쌀', position: 0 },
        ],
        meal_entry_recipes: [{ recipe_id: null, recipe_name: '채소죽', position: 0 }],
      },
    ]
    expect(await fetchMealWeek('2026-11-09', '2026-11-15')).toEqual([
      {
        ...input,
        id: 'm1',
        eaten: true,
        intake: 'good',
        foods: [
          { id: 'f1', name: '쌀' },
          { id: null, name: '보리' },
        ],
      },
    ])
    expect(chain.gte).toHaveBeenCalledWith('date', '2026-11-09')
    expect(chain.lte).toHaveBeenCalledWith('date', '2026-11-15')
    expect(mock.from).toHaveBeenCalledWith('meal_entries')
  })
  it('ID로 직접 열 때 없는 기록은 null로 반환하고 조회 오류는 전파한다', async () => {
    expect(await fetchMealEntry('missing')).toBeNull()
    expect(chain.eq).toHaveBeenCalledWith('id', 'missing')
    mock.result.error = { code: 'network', message: 'network' }
    await expect(fetchMealWeek('2026-11-09', '2026-11-15')).rejects.toMatchObject({
      code: 'network',
    })
  })
  it('저장·수정은 RPC를 쓰고 null ID·이름·먹음·선택 해제를 보존한다', async () => {
    expect(await saveMealEntry(input, 'm1')).toEqual({
      id: 'm1',
      firstTriedFoods: [{ id: 'f1', name: '쌀' }],
    })
    expect(mock.rpc).toHaveBeenCalledWith('save_meal_entry', {
      id: 'm1',
      date: '2026-11-11',
      meal_type: 'lunch',
      eaten: false,
      intake: undefined,
      memo: undefined,
      foods: [
        { food_id: 'f1', food_name: '쌀' },
        { food_id: null, food_name: '삭제된 음식' },
      ],
      recipes: [{ recipe_id: null, recipe_name: '채소죽' }],
    })
  })
  it.each([
    ['23505', 'duplicate'],
    ['22007', 'futureDate'],
    ['23503', 'staleItem'],
    ['P0002', 'notFound'],
    ['22023', 'selection'],
    ['23514', 'memoLength'],
  ])('서버 오류 %s를 입력 안내 %s로 바꾼다', async (code, reason) => {
    mock.rpc.mockResolvedValue({ data: null, error: { code, message: 'meal_entries_memo_length' } })
    await expect(saveMealEntry(input)).rejects.toMatchObject({ reason })
  })
  it('삭제도 RPC를 사용하고 통신 오류는 재시도 가능한 오류로 보낸다', async () => {
    await deleteMealEntry('m1')
    expect(mock.rpc).toHaveBeenCalledWith('delete_meal_entry', { id: 'm1' })
    mock.rpc.mockResolvedValue({ data: null, error: { code: 'network', message: 'network' } })
    await expect(deleteMealEntry('m1')).rejects.toBeInstanceOf(MealSaveError)
  })
})

describe('먹음 체크 API (T-44)', () => {
  it('체크는 내용 저장을 거치지 않고 전용 RPC 결과의 첫 시도 목록을 반환한다', async () => {
    expect(await setMealEaten('m1', true)).toEqual({
      id: 'm1',
      firstTriedFoods: [{ id: 'f1', name: '쌀' }],
    })
    expect(mock.rpc).toHaveBeenCalledExactlyOnceWith('set_meal_eaten', { id: 'm1', eaten: true })
  })
  it('미래 날짜·삭제된 기록 오류와 잘못된 응답을 전파한다', async () => {
    for (const [code, reason] of [
      ['22007', 'futureDate'],
      ['P0002', 'notFound'],
    ]) {
      mock.rpc.mockResolvedValueOnce({ data: null, error: { code, message: '' } })
      await expect(setMealEaten('m1', true)).rejects.toMatchObject({ reason })
    }
    mock.rpc.mockResolvedValueOnce({
      data: { id: 'm1', first_tried_foods: [{ id: 'f1' }] },
      error: null,
    })
    await expect(setMealEaten('m1', false)).rejects.toMatchObject({ reason: 'network' })
  })
})

it('이동 API는 날짜·끼니·명시적 체크 해제를 전용 RPC로 보낸다', async () => {
  expect(await moveMealEntry('m1', { date: '2026-11-20', type: 'dinner' }, true)).toEqual({
    id: 'm1',
    firstTriedFoods: [{ id: 'f1', name: '쌀' }],
  })
  expect(mock.rpc).toHaveBeenCalledExactlyOnceWith('move_meal_entry', {
    id: 'm1',
    date: '2026-11-20',
    meal_type: 'dinner',
    uncheck: true,
  })
  mock.rpc.mockResolvedValueOnce({ data: null, error: { code: '23505', message: '' } })
  await expect(
    moveMealEntry('m1', { date: '2026-11-11', type: 'lunch' }, false),
  ).rejects.toMatchObject({ reason: 'duplicate' })
})

it('서버의 생년월일 이전 오류를 미래 날짜 오류와 구분한다', async () => {
  mock.rpc.mockResolvedValueOnce({
    data: null,
    error: { code: '22007', message: 'date는 생년월일보다 이를 수 없습니다' },
  })
  await expect(
    moveMealEntry('m1', { date: '2026-01-01', type: 'lunch' }, false),
  ).rejects.toMatchObject({ reason: 'beforeBirth' })
})
