import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchMyChild } from '@/lib/childApi'
import { fetchFoods } from '@/lib/foodApi'
import { fetchMealWeek, moveMealEntry, MealSaveError, type MealEntry } from '@/lib/mealApi'
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
  moveMealEntry: vi.fn(),
}))
const auth = { status: 'signedIn' as const, session: { user: { id: 'u1' } } as Session }
let entries: MealEntry[]
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
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 11, 9))
  vi.resetAllMocks()
  entries = [
    {
      id: 'm1',
      date: '2026-11-11',
      type: 'lunch',
      eaten: true,
      intake: 'good',
      memo: '원래 메모',
      foods: [{ id: 'f1', name: '쌀' }],
      recipes: [],
    },
  ]
  vi.mocked(fetchMyChild).mockResolvedValue({
    id: 'c1',
    nickname: '하늘이',
    birthDate: '2026-01-08',
  })
  vi.mocked(fetchFoods).mockResolvedValue([])
  vi.mocked(fetchMealWeek).mockImplementation(async (start, end) =>
    entries.filter((entry) => entry.date >= start && entry.date <= end),
  )
  vi.mocked(moveMealEntry).mockImplementation(async (id, target, uncheck) => {
    if (
      entries.some(
        (entry) => entry.id !== id && entry.date === target.date && entry.type === target.type,
      )
    )
      throw new MealSaveError('duplicate')
    entries = entries.map((entry) =>
      entry.id === id ? { ...entry, ...target, eaten: uncheck ? false : entry.eaten } : entry,
    )
    return { id, firstTriedFoods: [] }
  })
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})
const closed = () =>
  waitFor(() =>
    expect(document.querySelector('[data-slot="sheet-content"]')).not.toBeInTheDocument(),
  )
async function openMove() {
  const state = renderApp('/meals/week', auth)
  const day = await screen.findByRole('region', { name: '2026. 11. 11. (수)' })
  await userEvent.click(within(day).getByRole('button', { name: '점심 식단 이동' }))
  await screen.findByRole('dialog', { name: '식단 이동' })
  return state
}
function drag(date = '2026. 11. 10. (화)', label = '저녁') {
  const data = new Map<string, string>()
  const dataTransfer = {
    setData: (key: string, value: string) => data.set(key, value),
    getData: (key: string) => data.get(key),
    effectAllowed: '',
    dropEffect: '',
  }
  fireEvent.dragStart(screen.getByRole('button', { name: '점심 식단 드래그로 이동' }), {
    dataTransfer,
  })
  const target = within(screen.getByRole('region', { name: date })).getByRole('button', {
    name: `${label} 식단 추가`,
  }).parentElement!
  fireEvent.dragOver(target, { dataTransfer })
  fireEvent.drop(target, { dataTransfer })
}
function desktop(matches = true) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((media: string) => ({
      matches,
      media,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    })),
  )
}

describe('식단 이동 화면 (T-45)', () => {
  it('메뉴에서 현재 날짜·끼니를 채우고 생년월일 전 날짜를 거부한다', async () => {
    await openMove()
    expect(screen.getByLabelText('옮길 날짜')).toHaveValue('2026-11-11')
    expect(screen.getByRole('radio', { name: '점심' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.change(screen.getByLabelText('옮길 날짜'), { target: { value: '2026-01-07' } })
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '이동' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('생년월일 이전')
    expect(moveMealEntry).not.toHaveBeenCalled()
  })
  it('메뉴로 과거 날짜·끼니를 바꾸고 내용과 체크를 유지하며 옮긴 요일을 선택한다', async () => {
    await openMove()
    fireEvent.change(screen.getByLabelText('옮길 날짜'), { target: { value: '2026-11-10' } })
    await userEvent.click(screen.getByRole('radio', { name: '저녁' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '이동' }))
    await closed()
    expect(moveMealEntry).toHaveBeenCalledExactlyOnceWith(
      'm1',
      { date: '2026-11-10', type: 'dinner' },
      false,
    )
    expect(entries[0]).toMatchObject({ eaten: true, memo: '원래 메모', intake: 'good' })
    expect(screen.getByRole('button', { name: '2026. 11. 10. (화) · 기록 있음' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(fetchFoods).toHaveBeenCalledTimes(2)
  })
  it('먹은 식단의 미래 이동은 확인을 취소하면 유지하고 확인하면 체크 해제한다', async () => {
    await openMove()
    fireEvent.change(screen.getByLabelText('옮길 날짜'), { target: { value: '2026-11-12' } })
    const submit = () => within(screen.getByRole('dialog')).getByRole('button', { name: '이동' })
    await userEvent.click(submit())
    const confirmation = await screen.findByRole('alertdialog')
    expect(confirmation).toHaveTextContent('먹음 체크를 해제하고 옮길까요?')
    expect(moveMealEntry).not.toHaveBeenCalled()
    await userEvent.click(within(confirmation).getByRole('button', { name: '취소' }))
    expect(screen.getByLabelText('옮길 날짜')).toHaveValue('2026-11-12')
    await userEvent.click(submit())
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: '체크 해제하고 이동',
      }),
    )
    await closed()
    expect(moveMealEntry).toHaveBeenCalledExactlyOnceWith(
      'm1',
      { date: '2026-11-12', type: 'lunch' },
      true,
    )
    expect(entries[0].eaten).toBe(false)
  })
  it('계획은 미래 다른 주로 확인 없이 옮기고 해당 주·요일을 보여 준다', async () => {
    entries[0].eaten = false
    const { router } = await openMove()
    fireEvent.change(screen.getByLabelText('옮길 날짜'), { target: { value: '2026-11-20' } })
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '이동' }))
    await closed()
    expect(router.state.location.search).toBe('?week=2026-11-16')
    expect(
      await screen.findByRole('button', { name: '2026. 11. 20. (금) · 기록 있음' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(entries[0].eaten).toBe(false)
  })
  it('충돌 시 두 기록을 유지하고 선택을 바꿔 다시 이동할 수 있다', async () => {
    entries.push({ ...entries[0], id: 'other', date: '2026-11-10' })
    await openMove()
    fireEvent.change(screen.getByLabelText('옮길 날짜'), { target: { value: '2026-11-10' } })
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '이동' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('그 끼니에는 이미 기록이 있어요')
    expect(entries.map((entry) => entry.date)).toEqual(['2026-11-11', '2026-11-10'])
    await userEvent.click(screen.getByRole('radio', { name: '저녁' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '이동' }))
    await closed()
    expect(entries[0]).toMatchObject({ date: '2026-11-10', type: 'dinner' })
  })
  it('통신 오류 시 날짜·끼니를 유지하고 다시 시도한다', async () => {
    vi.mocked(moveMealEntry).mockRejectedValueOnce(new MealSaveError('network'))
    await openMove()
    await userEvent.click(screen.getByRole('radio', { name: '저녁' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '이동' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('옮기지 못했어요')
    expect(screen.getByRole('radio', { name: '저녁' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await closed()
    expect(moveMealEntry).toHaveBeenCalledTimes(2)
  })
  it('PC 드래그는 과거 칸으로 바로 이동한다', async () => {
    desktop()
    renderApp('/meals/week', auth)
    await screen.findByRole('button', { name: '점심 식단 이동' })
    drag()
    await waitFor(() =>
      expect(moveMealEntry).toHaveBeenCalledExactlyOnceWith(
        'm1',
        { date: '2026-11-10', type: 'dinner' },
        false,
      ),
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('PC의 미래 드래그도 확인 취소 시 이동하지 않는다', async () => {
    desktop()
    renderApp('/meals/week', auth)
    await screen.findByRole('button', { name: '점심 식단 이동' })
    drag('2026. 11. 12. (목)')
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: '취소' }),
    )
    expect(moveMealEntry).not.toHaveBeenCalled()
    expect(entries[0].date).toBe('2026-11-11')
  })
  it('모바일 드래그는 무시하고 이동 버튼은 제공한다', async () => {
    desktop(false)
    renderApp('/meals/week', auth)
    await screen.findByRole('button', { name: '점심 식단 이동' })
    drag()
    expect(moveMealEntry).not.toHaveBeenCalled()
  })
  it('처리 중에는 닫기·중복 이동을 막는다', async () => {
    let resolve!: () => void
    vi.mocked(moveMealEntry).mockImplementationOnce(
      (id) =>
        new Promise((done) => {
          resolve = () => done({ id, firstTriedFoods: [] })
        }),
    )
    await openMove()
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '이동' }))
    expect(screen.getByRole('button', { name: '옮기는 중…' })).toBeDisabled()
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await act(async () => resolve())
    await closed()
    expect(moveMealEntry).toHaveBeenCalledTimes(1)
  })
})
