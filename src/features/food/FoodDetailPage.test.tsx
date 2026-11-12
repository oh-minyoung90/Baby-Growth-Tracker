import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchMyChild } from '@/lib/childApi'
import {
  clearCautionTag,
  deleteFood,
  fetchFood,
  fetchFoods,
  setFoodPreference,
  type Food,
} from '@/lib/foodApi'
import {
  fetchFoodEatenMeals,
  fetchFoodMealCounts,
  fetchFoodStatusHistory,
  type FoodStatusHistory,
} from '@/lib/foodDetailApi'
import { renderApp } from '@/test/renderApp'
vi.mock('@/lib/childApi', async (original) => ({
  ...(await original<typeof import('@/lib/childApi')>()),
  fetchMyChild: vi.fn(),
}))
vi.mock('@/lib/foodApi', async (original) => ({
  ...(await original<typeof import('@/lib/foodApi')>()),
  fetchFoods: vi.fn(),
  fetchFood: vi.fn(),
  setFoodPreference: vi.fn(),
  clearCautionTag: vi.fn(),
  deleteFood: vi.fn(),
}))
vi.mock('@/lib/foodDetailApi', () => ({
  fetchFoodEatenMeals: vi.fn(),
  fetchFoodMealCounts: vi.fn(),
  fetchFoodStatusHistory: vi.fn(),
}))
const auth = { status: 'signedIn' as const, session: { user: { id: 'u1' } } as Session }
let food: Food
beforeAll(() =>
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  ),
)
afterAll(() => vi.unstubAllGlobals())
beforeEach(() => {
  vi.resetAllMocks()
  food = {
    id: 'f1',
    name: '달걀',
    group: 'protein',
    status: 'tried',
    cautionTag: false,
    firstTriedDate: '2026-10-01',
    manualTried: false,
    manualFirstTriedDate: null,
    preference: 'like',
    memo: '음식 메모',
    reactionDate: null,
    symptomNote: null,
    checkNote: null,
  }
  vi.mocked(fetchMyChild).mockResolvedValue({
    id: 'c1',
    nickname: '하늘이',
    birthDate: '2026-01-08',
  })
  vi.mocked(fetchFoods).mockImplementation(async () => [{ ...food }])
  vi.mocked(fetchFood).mockImplementation(async (id) => (id === food.id ? { ...food } : null))
  vi.mocked(fetchFoodMealCounts).mockResolvedValue({ f1: 2 })
  vi.mocked(fetchFoodEatenMeals).mockResolvedValue({
    items: [
      { id: 'm2', date: '2026-11-11', type: 'lunch', intake: 'good' },
      { id: 'm1', date: '2026-10-01', type: 'breakfast', intake: null },
    ],
    nextOffset: undefined,
  })
  vi.mocked(fetchFoodStatusHistory).mockResolvedValue({ items: [], nextOffset: undefined })
  vi.mocked(setFoodPreference).mockImplementation(async (_, preference) => {
    food = { ...food, preference }
    return food
  })
  vi.mocked(clearCautionTag).mockImplementation(async () => {
    food = { ...food, cautionTag: false, reactionDate: null, symptomNote: null, checkNote: null }
    return food
  })
})
async function open() {
  const state = renderApp('/meals/foods/f1', auth)
  await screen.findByRole('heading', { name: '달걀' })
  return state
}
const historyRow = (values: Partial<FoodStatusHistory> = {}): FoodStatusHistory => ({
  id: 'h1',
  changed_at: '2026-11-11T01:00:00Z',
  from_status: 'caution',
  to_status: 'tried',
  caution_tag: false,
  trigger: 'manual',
  reason: '소아과에서 확인',
  reaction_date: '2026-10-01',
  symptom_note: '이전에 기록한 증상',
  check_note: '이전에 기록한 진료',
  meal_entry_id: null,
  ...values,
})

describe('음식 상세 (T-46)', () => {
  it('목록에서 상세로 연결하고 뒤로 가면 상태·식품군 필터가 유지된다', async () => {
    const { router } = renderApp('/meals/foods?status=tried&group=protein&q=달걀', auth)
    const item = await screen.findByRole('button', { name: /달걀/ })
    expect(item).toHaveTextContent('2번 먹음')
    await userEvent.click(item)
    expect(await screen.findByRole('heading', { name: '달걀' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/meals/foods/f1')
    await userEvent.click(screen.getByRole('button', { name: '음식 목록으로' }))
    await waitFor(() => {
      expect(new URLSearchParams(router.state.location.search).get('q')).toBe('달걀')
      expect(new URLSearchParams(router.state.location.search).get('group')).toBe('protein')
    })
  })
  it('기본 정보·횟수·최신 식단·먹은 정도와 식단 링크를 표시한다', async () => {
    await open()
    const info = within(screen.getByRole('region', { name: '음식 정보' }))
    expect(info.getByText('육류·생선')).toBeInTheDocument()
    expect(await info.findByText('2번')).toBeInTheDocument()
    expect(info.getByText('음식 메모')).toBeInTheDocument()
    const links = within(screen.getByRole('list', { name: '먹은 식단' })).getAllByRole('link')
    expect(links[0]).toHaveTextContent('2026. 11. 11. (수) · 점심잘 먹음')
    expect(links[0]).toHaveAttribute('href', '/meals/week?week=2026-11-11&record=m2')
    expect(links[1]).toHaveTextContent('먹은 정도 미입력')
    expect(screen.getByText('상태 변경 이력이 없어요')).toBeInTheDocument()
  })
  it('반응을 바로 선택·해제하고 식단 섭취량과 다른 정보는 바꾸지 않는다', async () => {
    await open()
    await userEvent.click(screen.getByRole('radio', { name: '매우 좋아함' }))
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: '매우 좋아함' })).toHaveAttribute(
        'aria-checked',
        'true',
      ),
    )
    expect(setFoodPreference).toHaveBeenLastCalledWith('f1', 'love')
    await userEvent.click(screen.getByRole('radio', { name: '매우 좋아함' }))
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: '매우 좋아함' })).toHaveAttribute(
        'aria-checked',
        'false',
      ),
    )
    expect(setFoodPreference).toHaveBeenLastCalledWith('f1', null)
    expect(food.memo).toBe('음식 메모')
    expect(screen.getByText('잘 먹음')).toBeInTheDocument()
  })
  it('안 먹어봄에는 반응 선택을 제공하지 않고 0회·모름·빈 식단을 표시한다', async () => {
    food = { ...food, status: 'not_tried', firstTriedDate: null, preference: null }
    vi.mocked(fetchFoodMealCounts).mockResolvedValue({})
    vi.mocked(fetchFoodEatenMeals).mockResolvedValue({ items: [], nextOffset: undefined })
    await open()
    expect(screen.queryByRole('radiogroup', { name: '아이 반응' })).not.toBeInTheDocument()
    expect(await screen.findByText('0번')).toBeInTheDocument()
    expect(screen.getByText('모름')).toBeInTheDocument()
    expect(screen.getByText('먹음으로 기록한 식단이 없어요')).toBeInTheDocument()
  })
  it('주의 태그와 현재 정보 및 해제 이력에 저장된 이전 정보를 따로 보여 준다', async () => {
    food = {
      ...food,
      cautionTag: true,
      reactionDate: '2026-11-01',
      symptomNote: '현재 증상',
      checkNote: '현재 확인',
    }
    vi.mocked(fetchFoodStatusHistory).mockResolvedValue({
      items: [historyRow()],
      nextOffset: undefined,
    })
    await open()
    expect(
      within(screen.getByRole('region', { name: '알러지·주의 정보' })).getByText('현재 증상'),
    ).toBeInTheDocument()
    const history = within(await screen.findByRole('list', { name: '상태 변경 이력' }))
    expect(history.getByText('알러지·주의 해제')).toBeInTheDocument()
    expect(history.getByText('이전에 기록한 증상')).toBeInTheDocument()
    expect(history.getByText('이전에 기록한 진료')).toBeInTheDocument()
    expect(history.getByText('사유: 소아과에서 확인')).toBeInTheDocument()
  })
  it('태그 해제 시 사유를 확인받고 상세를 유지한 채 정보·이력을 갱신한다', async () => {
    food.cautionTag = true
    vi.mocked(clearCautionTag).mockImplementationOnce(async (_, reason) => {
      food = { ...food, cautionTag: false }
      vi.mocked(fetchFoodStatusHistory).mockResolvedValue({
        items: [historyRow({ from_status: 'tried', reason })],
        nextOffset: undefined,
      })
      return food
    })
    const { router } = await open()
    await userEvent.click(screen.getByRole('button', { name: '"주의" 태그 해제' }))
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: '사유 (선택)' }),
      '확인하고 해제',
    )
    await userEvent.click(within(dialog).getByRole('button', { name: '해제' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(clearCautionTag).toHaveBeenCalledExactlyOnceWith('f1', '확인하고 해제')
    expect(router.state.location.pathname).toBe('/meals/foods/f1')
    expect(screen.getByText('사유: 확인하고 해제')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '알러지·주의 정보' })).not.toBeInTheDocument()
  })
  it('식단·이력 다음 페이지를 이어 붙이고 자동 전환·복원과 관련 식단을 표시한다', async () => {
    vi.mocked(fetchFoodEatenMeals).mockImplementation(async (_, offset) => ({
      items: [
        {
          id: offset ? 'older' : 'newer',
          date: offset ? '2026-10-01' : '2026-11-11',
          type: 'lunch',
          intake: null,
        },
      ],
      nextOffset: offset ? undefined : 20,
    }))
    vi.mocked(fetchFoodStatusHistory).mockImplementation(async (_, offset) => ({
      items: [
        historyRow({
          id: offset ? 'h2' : 'h1',
          trigger: offset ? 'revert' : 'meal_entry',
          meal_entry_id: offset ? null : 'm2',
        }),
      ],
      nextOffset: offset ? undefined : 20,
    }))
    await open()
    await userEvent.click(await screen.findByRole('button', { name: '식단 더 보기' }))
    await userEvent.click(screen.getByRole('button', { name: '이력 더 보기' }))
    expect(await screen.findByText('식단 변경으로 알러지·주의 복원')).toBeInTheDocument()
    expect(screen.getByText('식단 기록으로 먹어봄 전환')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '관련 식단 보기' })).toHaveAttribute(
      'href',
      '/meals/week?record=m2',
    )
    expect(
      within(screen.getByRole('list', { name: '먹은 식단' })).getAllByRole('listitem'),
    ).toHaveLength(2)
  })
  it('조회 실패를 재시도하고 없는 음식은 안내한다', async () => {
    vi.mocked(fetchFood).mockRejectedValueOnce(new Error('network'))
    renderApp('/meals/foods/f1', auth)
    expect(await screen.findByRole('alert')).toHaveTextContent('음식 정보를 불러오지 못했어요')
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByRole('heading', { name: '달걀' })).toBeInTheDocument()
  })
  it('삭제·타인 음식 상세는 수정 버튼 없이 안내한다', async () => {
    renderApp('/meals/foods/missing', auth)
    expect(await screen.findByRole('alert')).toHaveTextContent('음식을 찾을 수 없어요')
    expect(screen.queryByRole('button', { name: '수정' })).not.toBeInTheDocument()
  })
  it('반응 저장 실패는 기존 반응을 유지하며 다시 시도한다', async () => {
    vi.mocked(setFoodPreference).mockRejectedValueOnce(new Error('network'))
    await open()
    await userEvent.click(screen.getByRole('radio', { name: '거부' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('반응을 저장하지 못했어요')
    expect(screen.getByRole('radio', { name: '좋아함' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: '거부' })).toHaveAttribute('aria-checked', 'true'),
    )
  })
  it('수정은 기존 입력 시트를 재사용하고 뒤로 가기로 상세로 돌아온다', async () => {
    const { router } = await open()
    await userEvent.click(screen.getByRole('button', { name: '수정' }))
    expect(await screen.findByRole('dialog', { name: '음식 수정' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('?record=f1')
    await act(async () => {
      await router.navigate(-1)
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { name: '달걀' })).toBeInTheDocument()
  })
})

it('식단 조회에 실패해도 기본 정보를 유지하고 다시 시도한다', async () => {
  vi.mocked(fetchFoodEatenMeals).mockRejectedValueOnce(new Error('network'))
  await open()
  expect(await screen.findByRole('alert')).toHaveTextContent('먹은 식단을 불러오지 못했어요')
  expect(screen.getByRole('heading', { name: '달걀' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  expect(await screen.findByRole('list', { name: '먹은 식단' })).toBeInTheDocument()
})
it('다음 이력 조회 실패 시 기존 목록을 유지하고 같은 페이지를 다시 시도한다', async () => {
  vi.mocked(fetchFoodStatusHistory).mockImplementation(async (_, offset) => {
    if (offset) throw new Error('network')
    return { items: [historyRow()], nextOffset: 20 }
  })
  await open()
  await userEvent.click(await screen.findByRole('button', { name: '이력 더 보기' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('이력을 더 불러오지 못했어요')
  expect(screen.getByText('이전에 기록한 증상')).toBeInTheDocument()
  vi.mocked(fetchFoodStatusHistory).mockResolvedValueOnce({
    items: [historyRow({ id: 'older', trigger: 'revert' })],
    nextOffset: undefined,
  })
  await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  expect(await screen.findByText('식단 변경으로 알러지·주의 복원')).toBeInTheDocument()
  expect(
    within(screen.getByRole('list', { name: '상태 변경 이력' })).getAllByRole('listitem'),
  ).toHaveLength(2)
})
it('상세의 수정 시트에서 삭제하면 음식 목록으로 돌아온다', async () => {
  vi.mocked(deleteFood).mockImplementationOnce(async () => {
    vi.mocked(fetchFood).mockResolvedValue(null)
    vi.mocked(fetchFoods).mockResolvedValue([])
  })
  const { router } = await open()
  await userEvent.click(screen.getByRole('button', { name: '수정' }))
  const sheet = await screen.findByRole('dialog', { name: '음식 수정' })
  await userEvent.click(within(sheet).getByRole('button', { name: '삭제' }))
  await userEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: '삭제' }),
  )
  await waitFor(() => expect(router.state.location.pathname).toBe('/meals/foods'))
  expect(deleteFood).toHaveBeenCalledExactlyOnceWith('f1')
  expect(await screen.findByText('아직 음식이 없어요')).toBeInTheDocument()
})
