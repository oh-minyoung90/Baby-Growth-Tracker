import { fetchRecipes } from '@/lib/recipeApi'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatDateLabel } from '@/domain/date'
import { fetchMyChild } from '@/lib/childApi'
import { createFood, fetchFoods, FoodSaveError, type Food } from '@/lib/foodApi'
import {
  deleteMealEntry,
  fetchMealEntry,
  fetchMealWeek,
  MealSaveError,
  saveMealEntry,
  setMealEaten,
  type MealEntry,
} from '@/lib/mealApi'
import { notifyDone, notifySaved } from '@/lib/notify'
import { renderApp } from '@/test/renderApp'

vi.mock('@/lib/recipeApi', async (original) => ({
  ...(await original<typeof import('@/lib/recipeApi')>()),
  fetchRecipes: vi.fn(),
}))
vi.mock('@/lib/notify', () => ({ notifyDone: vi.fn(), notifySaved: vi.fn() }))
vi.mock('@/lib/childApi', async (original) => ({
  ...(await original<typeof import('@/lib/childApi')>()),
  fetchMyChild: vi.fn(),
}))
vi.mock('@/lib/foodApi', async (original) => ({
  ...(await original<typeof import('@/lib/foodApi')>()),
  fetchFoods: vi.fn(),
  createFood: vi.fn(),
}))
vi.mock('@/lib/mealApi', async (original) => ({
  ...(await original<typeof import('@/lib/mealApi')>()),
  fetchMealWeek: vi.fn(),
  fetchMealEntry: vi.fn(),
  saveMealEntry: vi.fn(),
  setMealEaten: vi.fn(),
  deleteMealEntry: vi.fn(),
}))
// jsdom에는 Radix 체크박스의 크기 관찰 API가 없어 이 파일에서만 대체한다.
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

const auth = { status: 'signedIn' as const, session: { user: { id: 'u1' } } as Session }
const makeFood = (id: string, name: string): Food => ({
  id,
  name,
  group: 'grain',
  status: 'not_tried',
  cautionTag: false,
  firstTriedDate: null,
  manualTried: false,
  manualFirstTriedDate: null,
  preference: null,
  memo: null,
  reactionDate: null,
  symptomNote: null,
  checkNote: null,
})
const makeEntry = (values: Partial<MealEntry> = {}): MealEntry => ({
  id: 'm1',
  date: '2026-11-11',
  type: 'lunch',
  eaten: true,
  intake: 'good',
  memo: '원래 메모',
  foods: [{ id: 'f1', name: '쌀' }],
  recipes: [],
  ...values,
})
let entries: MealEntry[]
let foods: Food[]
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 11, 9))
  vi.resetAllMocks()
  vi.mocked(fetchRecipes).mockResolvedValue([])
  entries = []
  foods = [makeFood('f1', '쌀'), makeFood('f2', '보리')]
  vi.mocked(fetchMyChild).mockResolvedValue({
    id: 'c1',
    nickname: '하늘이',
    birthDate: '2026-01-08',
  })
  vi.mocked(fetchFoods).mockImplementation(async () => [...foods])
  vi.mocked(fetchMealWeek).mockImplementation(async (start, end) =>
    entries.filter((entry) => entry.date >= start && entry.date <= end),
  )
  vi.mocked(fetchMealEntry).mockImplementation(
    async (id) => entries.find((entry) => entry.id === id) ?? null,
  )
  vi.mocked(saveMealEntry).mockImplementation(async (input, id) => {
    const saved = { ...input, id: id ?? `m${entries.length + 1}` }
    entries = [...entries.filter((entry) => entry.id !== saved.id), saved]
    return { id: saved.id, firstTriedFoods: [] }
  })
  vi.mocked(setMealEaten).mockImplementation(async (id, eaten) => {
    entries = entries.map((entry) => (entry.id === id ? { ...entry, eaten } : entry))
    return { id, firstTriedFoods: [] }
  })
  vi.mocked(deleteMealEntry).mockImplementation(async (id) => {
    entries = entries.filter((entry) => entry.id !== id)
  })
  vi.mocked(createFood).mockImplementation(async (input) => {
    const added = { ...makeFood(`f${foods.length + 1}`, input.name), group: input.group }
    foods.push(added)
    return added
  })
})
afterEach(() => vi.useRealTimers())
const dialog = () => screen.getByRole('dialog')
const saveButton = () => within(dialog()).getByRole('button', { name: '저장' })
const selectFood = async (name = '쌀') => {
  const results = await screen.findByRole('list', { name: '음식 검색 결과' })
  await userEvent.click(within(results).getByRole('button', { name: new RegExp(`^${name}`) }))
}
async function openNew(date = '2026-11-11', type = '점심') {
  const state = renderApp('/meals/week', auth)
  const day = await screen.findByRole('region', { name: formatDateLabel(date) })
  await userEvent.click(within(day).getByRole('button', { name: `${type} 식단 추가` }))
  await screen.findByRole('dialog', { name: '식단 기록' })
  return state
}
async function openEdit() {
  const state = renderApp('/meals/week', auth)
  const day = await screen.findByRole('region', { name: formatDateLabel('2026-11-11') })
  await userEvent.click(within(day).getByRole('button', { name: /^점심 식단 수정/ }))
  await screen.findByLabelText('메모')
  return state
}
async function closed() {
  await waitFor(() =>
    expect(document.querySelector('[data-slot="sheet-content"]')).not.toBeInTheDocument(),
  )
}

describe('식단 입력·검증·화면 이동 (T-43)', () => {
  it('빈 칸의 날짜·끼니는 표시만 하고 오늘·과거는 먹음을 기본으로 켠다', async () => {
    const { router } = await openNew('2026-11-10', '저녁')
    expect(dialog()).toHaveTextContent('2026. 11. 10. (화) · 저녁')
    expect(screen.getByRole('checkbox', { name: '먹음' })).toBeChecked()
    expect(router.state.location.search).toContain('record=new')
    expect(router.state.location.search).toContain('date=2026-11-10')
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument()
  })
  it('미래 칸은 계획으로 시작하고 먹음을 체크할 수 없다', async () => {
    await openNew('2026-11-12')
    const checkbox = screen.getByRole('checkbox', { name: '먹음' })
    expect(checkbox).not.toBeChecked()
    expect(checkbox).toBeDisabled()
    await selectFood()
    await userEvent.click(saveButton())
    await closed()
    expect(saveMealEntry).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-11-12', eaten: false }),
      undefined,
    )
    const day = screen.getByRole('region', { name: formatDateLabel('2026-11-12') })
    expect(within(day).getByText('계획')).toBeInTheDocument()
  })
  it('선택 없이 저장할 수 없고 여러 음식을 골라 저장하면 목록에 바로 반영한다', async () => {
    await openNew()
    await userEvent.click(saveButton())
    expect(await screen.findByText('음식이나 레시피를 하나 이상 선택해 주세요')).toBeInTheDocument()
    expect(saveMealEntry).not.toHaveBeenCalled()
    await selectFood()
    await selectFood('보리')
    await userEvent.type(screen.getByLabelText('메모'), '반 공기')
    await userEvent.click(screen.getByRole('radio', { name: '보통' }))
    await userEvent.click(saveButton())
    await closed()
    expect(saveMealEntry).toHaveBeenCalledWith(
      {
        date: '2026-11-11',
        type: 'lunch',
        eaten: true,
        intake: 'normal',
        memo: '반 공기',
        foods: [
          { id: 'f1', name: '쌀' },
          { id: 'f2', name: '보리' },
        ],
        recipes: [],
      },
      undefined,
    )
    expect(await screen.findByText('쌀, 보리')).toBeInTheDocument()
  })
  it('선택한 음식은 중복 추가되지 않고 빼기로 제거할 수 있다', async () => {
    await openNew()
    await selectFood()
    expect(
      within(screen.getByRole('list', { name: '음식 검색 결과' })).getByRole('button', {
        name: /^쌀/,
      }),
    ).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: '쌀 빼기' }))
    expect(screen.queryByRole('list', { name: '선택한 음식' })).not.toBeInTheDocument()
  })
  it('취소와 휴대폰 뒤로 가기는 주소와 시트를 되돌리고 저장하지 않는다', async () => {
    const { router } = await openNew()
    await selectFood()
    await act(async () => {
      await router.navigate(-1)
    })
    await closed()
    expect(router.state.location.search).toBe('')
    expect(saveMealEntry).not.toHaveBeenCalled()
  })
  it('주소로 직접 연 입력 시트는 취소 후 자신의 날짜·끼니 매개변수만 지운다', async () => {
    const { router } = renderApp(
      '/meals/week?week=2026-11-09&record=new&date=2026-11-12&meal=snack',
      auth,
    )
    await screen.findByRole('dialog', { name: '식단 기록' })
    await userEvent.click(screen.getByRole('button', { name: '취소' }))
    await closed()
    expect(router.state.location.search).toBe('?week=2026-11-09')
  })
  it('저장 실패 시 입력을 유지하고 다시 시도할 수 있다', async () => {
    vi.mocked(saveMealEntry).mockRejectedValueOnce(new MealSaveError('network'))
    await openNew()
    await selectFood()
    await userEvent.type(screen.getByLabelText('메모'), '유지할 메모')
    await userEvent.click(saveButton())
    expect(await screen.findByRole('alert')).toHaveTextContent('저장하지 못했어요')
    expect(screen.getByLabelText('메모')).toHaveValue('유지할 메모')
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await closed()
    expect(saveMealEntry).toHaveBeenCalledTimes(2)
  })
  it('다른 기기에서 같은 끼니를 먼저 저장한 경우 덮어쓰지 않고 안내한다', async () => {
    vi.mocked(saveMealEntry).mockRejectedValueOnce(new MealSaveError('duplicate'))
    await openNew()
    await selectFood()
    await userEvent.click(saveButton())
    expect(await screen.findByText(/그 끼니에는 이미 식단이 있어요/)).toBeInTheDocument()
    expect(dialog()).toBeInTheDocument()
  })
  it('메모는 500자로 제한한다', async () => {
    await openNew()
    await selectFood()
    fireEvent.change(screen.getByLabelText('메모'), { target: { value: '가'.repeat(501) } })
    await userEvent.click(saveButton())
    expect(await screen.findByText('500자까지 입력할 수 있어요')).toBeInTheDocument()
    expect(saveMealEntry).not.toHaveBeenCalled()
  })
})

describe('새 음식 바로 추가 (FR-MEAL-06)', () => {
  it('식품군만 고르면 아직 안 먹어봄으로 생성하고 식단 선택에 넣는다', async () => {
    await openNew()
    await userEvent.type(screen.getByRole('searchbox', { name: '식단에 넣을 음식 검색' }), '애호박')
    await userEvent.click(await screen.findByRole('button', { name: '‘애호박’ 새 음식으로 추가' }))
    await userEvent.click(screen.getByRole('button', { name: '음식 추가' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('식품군을 골라 주세요')
    await userEvent.click(screen.getByRole('radio', { name: '채소' }))
    await userEvent.click(screen.getByRole('button', { name: '음식 추가' }))
    expect(await screen.findByRole('button', { name: '애호박 빼기' })).toBeInTheDocument()
    expect(createFood).toHaveBeenCalledWith({
      name: '애호박',
      group: 'vegetable',
      alreadyTried: false,
      firstTriedDate: null,
      memo: null,
      preference: null,
    })
    expect(saveMealEntry).not.toHaveBeenCalled()
  })
  it('기존 이름이면 새 음식 버튼을 보여 주지 않는다', async () => {
    await openNew()
    await userEvent.type(screen.getByRole('searchbox', { name: '식단에 넣을 음식 검색' }), ' 쌀 ')
    await screen.findByRole('list', { name: '음식 검색 결과' })
    expect(screen.queryByRole('button', { name: /새 음식으로 추가/ })).not.toBeInTheDocument()
  })
  it('새 음식 저장 실패 시 식품군과 식단 메모를 유지한다', async () => {
    vi.mocked(createFood).mockRejectedValueOnce(new FoodSaveError('network'))
    await openNew()
    await userEvent.type(screen.getByLabelText('메모'), '남길 메모')
    await userEvent.type(screen.getByRole('searchbox', { name: '식단에 넣을 음식 검색' }), '감자')
    await userEvent.click(screen.getByRole('button', { name: '‘감자’ 새 음식으로 추가' }))
    await userEvent.click(screen.getByRole('radio', { name: '채소' }))
    await userEvent.click(screen.getByRole('button', { name: '음식 추가' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('저장하지 못했어요')
    expect(screen.getByRole('radio', { name: '채소' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByLabelText('메모')).toHaveValue('남길 메모')
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByRole('button', { name: '감자 빼기' })).toBeInTheDocument()
  })
})

describe('식단 수정·삭제·주소 진입', () => {
  it('기존 값과 삭제된 음식·레시피 이름을 유지해 수정한다', async () => {
    entries = [
      makeEntry({
        foods: [{ id: null, name: '삭제된 음식' }],
        recipes: [{ id: null, name: '채소죽' }],
      }),
    ]
    await openEdit()
    expect(screen.getByLabelText('메모')).toHaveValue('원래 메모')
    expect(screen.getByRole('button', { name: '채소죽 빼기' })).toBeInTheDocument()
    await userEvent.clear(screen.getByLabelText('메모'))
    await userEvent.click(screen.getByRole('radio', { name: '선택 안 함' }))
    await userEvent.click(saveButton())
    await closed()
    expect(saveMealEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        foods: [{ id: null, name: '삭제된 음식' }],
        recipes: [{ id: null, name: '채소죽' }],
        intake: null,
        memo: null,
      }),
      'm1',
    )
  })
  it('삭제 확인 후 취소하면 유지하고 다시 확인하면 목록에서 삭제한다', async () => {
    entries = [makeEntry()]
    await openEdit()
    await userEvent.click(screen.getByRole('button', { name: '삭제' }))
    let confirm = await screen.findByRole('alertdialog', { name: '이 식단을 삭제할까요?' })
    await userEvent.click(within(confirm).getByRole('button', { name: '취소' }))
    expect(deleteMealEntry).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: '삭제' }))
    confirm = await screen.findByRole('alertdialog', { name: '이 식단을 삭제할까요?' })
    await userEvent.click(within(confirm).getByRole('button', { name: '삭제' }))
    await closed()
    expect(deleteMealEntry).toHaveBeenCalledWith('m1')
    expect(await screen.findByText('이번 주 식단을 계획해 보세요')).toBeInTheDocument()
  })
  it('다른 주의 기록도 ID 주소로 직접 열 수 있다', async () => {
    entries = [makeEntry({ date: '2026-10-20' })]
    renderApp('/meals/week?record=m1', auth)
    await screen.findByLabelText('메모')
    expect(dialog()).toHaveTextContent('2026. 10. 20. (화) · 점심')
    expect(await screen.findByText('2026년 10월 19일 ~ 25일')).toBeInTheDocument()
  })
  it('수정할 기록 조회 실패는 입력 창에서 다시 시도할 수 있다', async () => {
    entries = [makeEntry()]
    vi.mocked(fetchMealEntry).mockRejectedValueOnce(new Error('network'))
    renderApp('/meals/week?record=m1', auth)
    expect(await screen.findByRole('alert')).toHaveTextContent('정보를 불러오지 못했어요')
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByLabelText('메모')).toHaveValue('원래 메모')
  })
  it('없는 기록과 잘못된 입력 주소는 빈 폼을 만들지 않고 닫기를 제공한다', async () => {
    renderApp('/meals/week?record=missing', auth)
    expect(await screen.findByText(/식단을 찾을 수 없어요/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '닫기' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument()
  })
  it('저장 중에는 중복 제출·취소·Escape로 닫는 것을 막는다', async () => {
    let finish!: (result: { id: string; firstTriedFoods: [] }) => void
    vi.mocked(saveMealEntry).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    await openNew()
    await selectFood()
    await userEvent.click(saveButton())
    await waitFor(() => expect(saveMealEntry).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: '저장하는 중…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '취소' })).toBeDisabled()
    await userEvent.keyboard('{Escape}')
    expect(dialog()).toBeInTheDocument()
    await act(async () => finish({ id: 'm1', firstTriedFoods: [] }))
    await closed()
  })
})

describe('주의 경고·첫 시도 알림·표 먹음 체크 (T-44)', () => {
  it.each([false, true])(
    '먹음=%s 식단에도 즉시 경고하고 확인을 취소하면 입력을 유지한다',
    async (eaten) => {
      foods[0].status = 'caution'
      await openNew()
      await selectFood()
      if (!eaten) await userEvent.click(screen.getByRole('checkbox', { name: '먹음' }))
      expect(within(dialog()).getByRole('status')).toHaveTextContent(
        '주의가 필요한 음식이 있어요: 쌀',
      )
      await userEvent.click(saveButton())
      const confirmation = await screen.findByRole('alertdialog')
      expect(confirmation).toHaveTextContent('주의가 필요한 음식이 있어요: 쌀')
      expect(saveMealEntry).not.toHaveBeenCalled()
      await userEvent.click(within(confirmation).getByRole('button', { name: '취소' }))
      expect(screen.getByRole('checkbox', { name: '먹음' })).toHaveAttribute(
        'aria-checked',
        String(eaten),
      )
      expect(within(dialog()).getByRole('button', { name: '쌀 빼기' })).toBeInTheDocument()
      await userEvent.click(saveButton())
      await userEvent.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: '그래도 저장' }),
      )
      await closed()
      expect(saveMealEntry).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ eaten }),
        undefined,
      )
    },
  )

  it('주의 태그 음식도 경고하고 첫 시도 목록이 있을 때만 이름과 조사를 넣어 알린다', async () => {
    foods[0].status = 'tried'
    foods[0].cautionTag = true
    vi.mocked(saveMealEntry).mockResolvedValueOnce({
      id: 'm1',
      firstTriedFoods: [
        { id: 'f1', name: '쌀' },
        { id: 'f2', name: '보리' },
      ],
    })
    await openNew()
    await selectFood()
    await userEvent.click(saveButton())
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: '그래도 저장' }),
    )
    await closed()
    expect(notifyDone).toHaveBeenCalledExactlyOnceWith(
      '쌀, 보리를 처음 먹었어요. 타임라인에 남겼어요',
    )
    expect(notifySaved).not.toHaveBeenCalled()
  })

  it('표에서 체크를 켜고 꺼도 시트를 열지 않고 전용 RPC·식단/음식 갱신을 실행한다', async () => {
    entries = [makeEntry({ eaten: false })]
    const { router } = renderApp('/meals/week', auth)
    const check = await screen.findByRole('checkbox', { name: '2026. 11. 11. (수) 점심 먹음' })
    await waitFor(() => expect(check).toBeEnabled())
    await userEvent.click(check)
    await waitFor(() => expect(check).toBeChecked())
    expect(setMealEaten).toHaveBeenLastCalledWith('m1', true)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(router.state.location.search).toBe('')
    await userEvent.click(check)
    await waitFor(() => expect(check).not.toBeChecked())
    expect(setMealEaten).toHaveBeenLastCalledWith('m1', false)
    expect(fetchFoods).toHaveBeenCalledTimes(3)
    expect(saveMealEntry).not.toHaveBeenCalled()
  })

  it('미래 계획의 체크를 막고 주의 계획에는 체크 전 확인을 받는다', async () => {
    entries = [
      makeEntry({ eaten: false }),
      makeEntry({ id: 'future', date: '2026-11-12', eaten: false }),
    ]
    foods[0].status = 'caution'
    renderApp('/meals/week', auth)
    const check = await screen.findByRole('checkbox', { name: '2026. 11. 11. (수) 점심 먹음' })
    expect(screen.getByRole('checkbox', { name: '2026. 11. 12. (목) 점심 먹음' })).toBeDisabled()
    await waitFor(() => expect(check).toBeEnabled())
    const day = screen.getByRole('region', { name: formatDateLabel('2026-11-11') })
    expect(within(day).getByText('주의')).toBeInTheDocument()
    await userEvent.click(check)
    expect(setMealEaten).not.toHaveBeenCalled()
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: '취소' }),
    )
    expect(check).not.toBeChecked()
    await userEvent.click(check)
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: '그래도 저장' }),
    )
    await waitFor(() => expect(check).toBeChecked())
  })

  it('체크 실패 시 원래 상태를 유지하고 다시 시도하면 첫 시도 알림을 표시한다', async () => {
    entries = [makeEntry({ eaten: false })]
    vi.mocked(setMealEaten).mockRejectedValueOnce(new MealSaveError('network'))
    renderApp('/meals/week', auth)
    const check = await screen.findByRole('checkbox', { name: '2026. 11. 11. (수) 점심 먹음' })
    await waitFor(() => expect(check).toBeEnabled())
    await userEvent.click(check)
    expect(await screen.findByRole('alert')).toHaveTextContent('저장하지 못했어요')
    expect(check).not.toBeChecked()
    vi.mocked(setMealEaten).mockImplementationOnce(async (id, eaten) => {
      entries = entries.map((entry) => ({ ...entry, eaten }))
      return { id, firstTriedFoods: [{ id: 'f1', name: '쌀' }] }
    })
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(check).toBeChecked())
    expect(notifyDone).toHaveBeenCalledExactlyOnceWith('쌀을 처음 먹었어요. 타임라인에 남겼어요')
  })

  it('주의 정보를 못 읽으면 체크 켜기와 저장을 막고 다시 불러올 수 있다', async () => {
    entries = [makeEntry({ eaten: false })]
    vi.mocked(fetchFoods).mockRejectedValueOnce(new Error('network'))
    renderApp('/meals/week', auth)
    const check = await screen.findByRole('checkbox', { name: '2026. 11. 11. (수) 점심 먹음' })
    expect(await screen.findByRole('alert')).toHaveTextContent('주의 음식 정보를 불러오지 못했어요')
    expect(check).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(check).toBeEnabled())
  })
})

describe('먹음 체크 경합과 재시도', () => {
  it('저장 중에는 체크와 칸 편집을 막고 완료 후 다시 사용할 수 있다', async () => {
    entries = [makeEntry({ eaten: false })]
    let resolve!: () => void
    vi.mocked(setMealEaten).mockImplementationOnce(
      (id, eaten) =>
        new Promise((done) => {
          resolve = () => {
            entries = entries.map((entry) => ({ ...entry, eaten }))
            done({ id, firstTriedFoods: [] })
          }
        }),
    )
    renderApp('/meals/week', auth)
    const check = await screen.findByRole('checkbox', { name: '2026. 11. 11. (수) 점심 먹음' })
    await waitFor(() => expect(check).toBeEnabled())
    await userEvent.click(check)
    expect(check).toBeDisabled()
    expect(screen.getByRole('button', { name: /^점심 식단 수정/ })).toBeDisabled()
    await userEvent.click(check)
    expect(setMealEaten).toHaveBeenCalledTimes(1)
    await act(async () => resolve())
    await waitFor(() => expect(check).toBeEnabled())
    expect(check).toBeChecked()
  })

  it('실패 후 다시 시도할 때 새로 지정된 주의 음식도 확인한다', async () => {
    entries = [makeEntry({ eaten: false })]
    vi.mocked(setMealEaten).mockRejectedValueOnce(new MealSaveError('network'))
    const { queryClient } = renderApp('/meals/week', auth)
    const check = await screen.findByRole('checkbox', { name: '2026. 11. 11. (수) 점심 먹음' })
    await waitFor(() => expect(check).toBeEnabled())
    await userEvent.click(check)
    await screen.findByRole('alert')
    foods[0].status = 'caution'
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['foods'] })
    })
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      '주의가 필요한 음식이 있어요: 쌀',
    )
    expect(setMealEaten).toHaveBeenCalledTimes(1)
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: '그래도 저장' }),
    )
    await waitFor(() => expect(check).toBeChecked())
  })
})

describe('실제 레시피·재료 연동 (T-51)', () => {
  const recipe = () => ({
    id: 'r1',
    name: '주의 쌀죽',
    photoId: null,
    servings: null,
    note: null,
    steps: ['끓여요'],
    ingredients: [{ foodId: 'f1', name: '쌀', amount: '20g' }],
  })
  it('레시피만 선택한 계획에도 재료 경고·확인을 거치고 음식으로 자동 추가하지 않는다', async () => {
    foods[0].status = 'caution'
    vi.mocked(fetchRecipes).mockResolvedValue([recipe()])
    await openNew('2026-11-12')
    const results = await within(dialog()).findByRole('list', { name: '레시피 검색 결과' })
    await userEvent.click(within(results).getByRole('button', { name: '주의 쌀죽' }))
    expect(within(dialog()).getByRole('status')).toHaveTextContent(
      '주의가 필요한 음식이 있어요: 쌀',
    )
    await userEvent.click(saveButton())
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: '취소' }),
    )
    expect(saveMealEntry).not.toHaveBeenCalled()
    await userEvent.click(saveButton())
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: '그래도 저장' }),
    )
    await closed()
    expect(saveMealEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        foods: [],
        recipes: [{ id: 'r1', name: '주의 쌀죽' }],
        eaten: false,
      }),
      undefined,
    )
  })
  it('레시피 재료를 못 읽으면 저장을 막고 재조회 후 입력을 유지한다', async () => {
    vi.mocked(fetchRecipes).mockRejectedValue(new Error('offline'))
    await openNew()
    await selectFood()
    expect(saveButton()).toBeDisabled()
    const alert = await within(dialog()).findByRole('alert')
    expect(alert).toHaveTextContent('레시피와 재료 정보를 불러오지 못했어요')
    vi.mocked(fetchRecipes).mockResolvedValue([])
    await userEvent.click(within(alert).getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(saveButton()).toBeEnabled())
    expect(within(dialog()).getByRole('button', { name: '쌀 빼기' })).toBeInTheDocument()
  })
  it('표의 먹음 체크와 복사도 레시피 재료의 주의를 확인한다', async () => {
    foods[0].cautionTag = true
    vi.mocked(fetchRecipes).mockResolvedValue([recipe()])
    entries = [makeEntry({ foods: [], recipes: [{ id: 'r1', name: '주의 쌀죽' }], eaten: false })]
    renderApp('/meals/week', auth)
    const check = await screen.findByRole('checkbox', { name: '2026. 11. 11. (수) 점심 먹음' })
    await waitFor(() => expect(check).toBeEnabled())
    await userEvent.click(check)
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      '주의가 필요한 음식이 있어요: 쌀',
    )
    expect(setMealEaten).not.toHaveBeenCalled()
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: '취소' }),
    )
    const day = screen.getByRole('region', { name: formatDateLabel('2026-11-11') })
    await userEvent.click(within(day).getByRole('button', { name: '점심 식단 복사' }))
    expect(
      within(screen.getByRole('dialog', { name: '식단 복사' })).getByRole('status'),
    ).toHaveTextContent('쌀')
  })
})
