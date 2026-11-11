import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchFoods } from '@/lib/foodApi'
import { fetchMyChild } from '@/lib/childApi'
import { fetchMealWeek, type MealEntry } from '@/lib/mealApi'
import { renderApp } from '@/test/renderApp'

vi.mock('@/lib/childApi', async (original) => ({
  ...(await original<typeof import('@/lib/childApi')>()),
  fetchMyChild: vi.fn(),
}))
vi.mock('@/lib/foodApi', async (original) => ({
  ...(await original<typeof import('@/lib/foodApi')>()),
  fetchFoods: vi.fn(),
}))
vi.mock('@/lib/mealApi', async (original) => ({
  ...(await original<typeof import('@/lib/mealApi')>()),
  fetchMealWeek: vi.fn(),
}))
const auth = { status: 'signedIn' as const, session: { user: { id: 'u1' } } as Session }
const entry = (values: Partial<MealEntry> = {}): MealEntry => ({
  id: 'meal1',
  date: '2026-11-11',
  type: 'lunch',
  eaten: true,
  intake: 'good',
  memo: '테스트 메모',
  foods: [{ id: 'f1', name: '쌀미음' }],
  recipes: [],
  ...values,
})
let store: MealEntry[]
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 11, 9))
  vi.resetAllMocks()
  store = []
  vi.mocked(fetchFoods).mockResolvedValue([])
  vi.mocked(fetchMyChild).mockResolvedValue({
    id: 'c1',
    nickname: '하늘이',
    birthDate: '2026-01-08',
  })
  vi.mocked(fetchMealWeek).mockImplementation(async (start, end) =>
    store.filter((item) => item.date >= start && item.date <= end),
  )
})
afterEach(() => vi.useRealTimers())

describe('주간 식단 화면 (T-42)', () => {
  it('월~일 7개 카드와 빈 주 안내를 표시하고 오늘 요일을 선택한다', async () => {
    renderApp('/meals/week', auth)
    expect(await screen.findByText('이번 주 식단을 계획해 보세요')).toBeInTheDocument()
    expect(fetchMealWeek).toHaveBeenCalledWith('2026-11-09', '2026-11-15')
    expect(within(screen.getByLabelText('주간 식단표')).getAllByRole('region')).toHaveLength(7)
    expect(screen.getByRole('button', { name: '2026. 11. 11. (수)' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText('오늘')).toBeInTheDocument()
  })
  it('1건의 음식·삭제된 레시피 이름·섭취량·메모·계획을 표시한다', async () => {
    store = [entry({ eaten: false, recipes: [{ id: null, name: '채소죽' }] })]
    renderApp('/meals/week', auth)
    expect(await screen.findByText('쌀미음, 채소죽')).toBeInTheDocument()
    expect(screen.getByText('잘 먹음')).toBeInTheDocument()
    expect(screen.getByLabelText('메모 있음')).toBeInTheDocument()
    expect(screen.getByText('계획')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '2026. 11. 11. (수) · 기록 있음' }),
    ).toBeInTheDocument()
  })
  it('주 이동을 주소에 남기고 다른 주는 월요일부터 보여 준다', async () => {
    const { router } = renderApp('/meals/week', auth)
    await screen.findByText('이번 주 식단을 계획해 보세요')
    await userEvent.click(screen.getByRole('button', { name: '다음 주' }))
    expect(await screen.findByText('2026년 11월 16일 ~ 22일')).toBeInTheDocument()
    expect(router.state.location.search).toBe('?week=2026-11-16')
    expect(await screen.findByRole('button', { name: '2026. 11. 16. (월)' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await userEvent.click(screen.getByRole('button', { name: '이전 주' }))
    expect(await screen.findByRole('button', { name: '2026. 11. 11. (수)' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
  it('요일 칩을 고르고 이번 주를 누르면 오늘로 돌아간다', async () => {
    renderApp('/meals/week', auth)
    const monday = await screen.findByRole('button', { name: '2026. 11. 9. (월)' })
    await userEvent.click(monday)
    expect(monday).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: '이번 주' }))
    expect(await screen.findByRole('button', { name: '2026. 11. 11. (수)' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
  it('수평 스크롤로 보이는 카드가 바뀌면 요일 선택도 갱신한다', async () => {
    renderApp('/meals/week', auth)
    const board = await screen.findByLabelText('주간 식단표')
    within(board)
      .getAllByRole('region')
      .forEach((card, index) => Object.defineProperty(card, 'offsetLeft', { value: index * 360 }))
    Object.defineProperty(board, 'scrollLeft', { value: 4 * 360 })
    fireEvent.scroll(board)
    expect(screen.getByRole('button', { name: '2026. 11. 13. (금)' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
  it('조회 실패는 다시 시도하고 잘못된 주소도 안전하게 연다', async () => {
    vi.mocked(fetchMealWeek).mockRejectedValueOnce(new Error('network'))
    renderApp('/meals/week?week=not-a-date', auth)
    expect(await screen.findByRole('alert')).toHaveTextContent('정보를 불러오지 못했어요')
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByText('이번 주 식단을 계획해 보세요')).toBeInTheDocument()
  })
  it('조회 중에는 로딩을 표시한다', async () => {
    let resolve!: (entries: MealEntry[]) => void
    vi.mocked(fetchMealWeek).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    renderApp('/meals/week', auth)
    await waitFor(() => expect(fetchMealWeek).toHaveBeenCalled())
    expect(await screen.findByRole('status')).toHaveTextContent('불러오는 중')
    await act(async () => resolve([]))
    expect(await screen.findByText('이번 주 식단을 계획해 보세요')).toBeInTheDocument()
  })
})
