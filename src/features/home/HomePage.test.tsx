import { fetchTasks } from '@/lib/taskApi'
import { fetchShoppingItems } from '@/lib/shoppingApi'
import { fetchMealWeek, fetchMealEntry, saveMealEntry, type MealEntry } from '@/lib/mealApi'
import { fetchFoods } from '@/lib/foodApi'
import { fetchRecipes } from '@/lib/recipeApi'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthState } from '@/lib/auth'
import { fetchBodyMeasures, type BodyMeasure } from '@/lib/bodyApi'
import { fetchMyChild } from '@/lib/childApi'
import { fetchMilestone, fetchMilestones, type Milestone } from '@/lib/milestoneApi'
import { fetchSleepLogs, type SleepLog } from '@/lib/sleepApi'
import { renderApp } from '@/test/renderApp'

vi.mock('@/lib/taskApi', () => ({ fetchTasks: vi.fn() }))
vi.mock('@/lib/shoppingApi', () => ({ fetchShoppingItems: vi.fn() }))

// 홈 (T-28, SCR-03, FR-HOME-01~06). 테스트 데이터는 가명이다.

vi.mock('@/lib/mealApi', async (original) => ({
  ...(await original<typeof import('@/lib/mealApi')>()),
  fetchMealWeek: vi.fn(),
  fetchMealEntry: vi.fn(),
  saveMealEntry: vi.fn(),
}))
vi.mock('@/lib/foodApi', async (original) => ({
  ...(await original<typeof import('@/lib/foodApi')>()),
  fetchFoods: vi.fn(),
}))
vi.mock('@/lib/recipeApi', async (original) => ({
  ...(await original<typeof import('@/lib/recipeApi')>()),
  fetchRecipes: vi.fn(),
}))
vi.mock('@/lib/childApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/childApi')>()),
  fetchMyChild: vi.fn(),
}))
vi.mock('@/lib/milestoneApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/milestoneApi')>()),
  fetchMilestones: vi.fn(),
  fetchMilestone: vi.fn(),
}))
vi.mock('@/lib/sleepApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/sleepApi')>()),
  fetchSleepLogs: vi.fn(),
}))
vi.mock('@/lib/bodyApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/bodyApi')>()),
  fetchBodyMeasures: vi.fn(),
}))

// jsdom에서 실제 식단 체크박스를 열기 위한 크기 관찰 API 대체.
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

const auth: AuthState = { status: 'signedIn', session: { user: { id: 'u1' } } as Session }

// 오늘은 2026-10-22(목), 어제는 10-21. 서버는 날짜 최신순으로 준다
const milestones: Milestone[] = [
  { id: 'w3', type: 'word', date: '2026-10-22', title: '물', memo: '컵을 가리키며' },
  { id: 'bh2', type: 'behavior', date: '2026-10-22', title: '혼자 서기', memo: null },
  { id: 'w2', type: 'word', date: '2026-10-21', title: '네', memo: null },
]
const sleepLogs: SleepLog[] = [
  {
    id: 's2',
    date: '2026-10-21',
    bedAt: '2026-10-21T21:00',
    wakeAt: '2026-10-22T06:30',
    naps: [
      { startAt: '2026-10-21T10:00', endAt: '2026-10-21T11:00' },
      { startAt: '2026-10-21T14:00', endAt: '2026-10-21T15:20' },
    ],
    memo: null,
  },
  {
    id: 's1',
    date: '2026-10-20',
    bedAt: '2026-10-20T21:00',
    wakeAt: '2026-10-21T07:00',
    naps: [],
    memo: null,
  },
]
const measures: BodyMeasure[] = [
  { id: 'm2', date: '2026-10-15', heightCm: 72.5, weightKg: null, memo: null },
  { id: 'm1', date: '2026-09-30', heightCm: 72.1, weightKg: 8.9, memo: '영유아 검진' },
]

beforeEach(() => {
  // 생년월일은 2026-01-08
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 22, 9, 0))
  vi.resetAllMocks()
  vi.mocked(fetchShoppingItems).mockResolvedValue([])
  vi.mocked(fetchTasks).mockResolvedValue([])
  vi.mocked(fetchMealWeek).mockResolvedValue([])
  vi.mocked(fetchMealEntry).mockResolvedValue(null)
  vi.mocked(fetchRecipes).mockResolvedValue([])
  vi.mocked(fetchFoods).mockResolvedValue([
    {
      id: 'f1',
      name: '쌀',
      group: 'grain',
      status: 'tried',
      cautionTag: false,
      firstTriedDate: '2026-09-01',
      preference: null,
      manualTried: true,
      manualFirstTriedDate: '2026-09-01',
      memo: null,
      reactionDate: null,
      symptomNote: null,
      checkNote: null,
    },
  ])
  vi.mocked(fetchMyChild).mockResolvedValue({
    id: 'c1',
    nickname: '하늘이',
    birthDate: '2026-01-08',
  })
  vi.mocked(fetchMilestones).mockResolvedValue(milestones)
  vi.mocked(fetchMilestone).mockImplementation(
    async (id) => milestones.find((record) => record.id === id) ?? null,
  )
  vi.mocked(fetchSleepLogs).mockResolvedValue(sleepLogs)
  vi.mocked(fetchBodyMeasures).mockResolvedValue(measures)
})
afterEach(() => vi.useRealTimers())

async function renderHome() {
  const result = renderApp('/', auth)
  await screen.findByRole('heading', { level: 1, name: /^하늘이/ })
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  return result
}

function card(name: string) {
  return screen.getByRole('region', { name })
}

describe('머리말 (FR-HOME-01)', () => {
  it('아이 이름, 오늘 기준 생후 일수, 오늘 날짜를 보여 준다', async () => {
    await renderHome()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('하늘이 · 생후 9개월 14일')
    expect(screen.getByText('2026. 10. 22. (목)')).toBeInTheDocument()
    expect(document.title).toBe('홈 · MyBabyLog')
  })
})

describe('오늘의 기록 (FR-HOME-02, 06)', () => {
  it('기록 날짜가 오늘인 발달 기록만 유형과 함께 보여 준다', async () => {
    await renderHome()
    const today = card('오늘의 기록')
    expect(
      within(today).queryByRole('button', { name: '오늘 성장 기록하기' }),
    ).not.toBeInTheDocument()
    const links = await within(today).findAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual(['단어물컵을 가리키며', '행동혼자 서기'])
  })

  it('기록을 누르면 수정 화면이 열리고, 취소하면 홈으로 돌아온다 (FR-COM-30)', async () => {
    const { router } = await renderHome()
    await userEvent.click(
      await within(card('오늘의 기록')).findByRole('link', { name: /혼자 서기/ }),
    )
    expect(router.state.location.pathname).toBe('/milestones/bh2')
    expect(await screen.findByRole('heading', { level: 1, name: '발달 기록 수정' })).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: '취소' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  it('오늘 기록이 없으면 성장 기록하기로 종류를 고르고 입력 후 홈으로 돌아온다', async () => {
    vi.mocked(fetchMilestones).mockResolvedValue(milestones.slice(2))
    const { router } = await renderHome()
    const button = await within(card('오늘의 기록')).findByRole('button', {
      name: '오늘 성장 기록하기',
    })
    await userEvent.click(button)
    let menu = await screen.findByRole('dialog', { name: '성장 기록' })
    expect(
      within(menu)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['단어', '행동', '표정'])
    await userEvent.click(within(menu).getByRole('button', { name: '취소' }))
    await waitFor(() => expect(button).toHaveFocus())
    await userEvent.click(button)
    menu = await screen.findByRole('dialog', { name: '성장 기록' })
    await userEvent.click(within(menu).getByRole('link', { name: '단어' }))
    const types = await screen.findByRole('radiogroup', { name: '유형' })
    expect(within(types).getByRole('radio', { name: '단어' })).toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: '취소' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(
      within(card('오늘의 기록')).getByRole('button', { name: '오늘 성장 기록하기' }),
    ).toBeVisible()
  })
})

describe('어젯밤 수면 (FR-HOME-03)', () => {
  it('수면일이 어제인 기록의 총 수면과 밤잠·낮잠을 보여 준다', async () => {
    await renderHome()
    const sleep = card('어젯밤 수면')
    expect(await within(sleep).findByText('11시간 50분')).toBeVisible()
    expect(within(sleep).getByText('9시간 30분')).toBeVisible()
    expect(within(sleep).getByText('2회 · 2시간 20분')).toBeVisible()
  })

  it('잠든·일어난 시간 중 하나만 있으면 총 수면과 밤잠은 계산 불가다 (R44)', async () => {
    vi.mocked(fetchSleepLogs).mockResolvedValue([
      { ...sleepLogs[0], wakeAt: null, naps: [] },
    ] satisfies SleepLog[])
    await renderHome()
    const sleep = card('어젯밤 수면')
    expect(await within(sleep).findAllByText('계산 불가')).toHaveLength(2)
    expect(within(sleep).getByText('없음')).toBeVisible()
  })

  it('어젯밤 기록이 없으면 기록하기 버튼으로 수면일이 어제인 입력 화면을 연다', async () => {
    vi.mocked(fetchSleepLogs).mockResolvedValue(sleepLogs.slice(1))
    const { router } = await renderHome()
    await userEvent.click(
      await within(card('어젯밤 수면')).findByRole('link', { name: '어젯밤 수면 기록하기' }),
    )
    expect(router.state.location.pathname).toBe('/sleep/new')
    expect(await screen.findByLabelText('수면일')).toHaveValue('2026-10-21')
  })
})

describe('최근 측정 (FR-HOME-04)', () => {
  it('가장 최근 측정의 키·몸무게와 측정 날짜를 보여 준다. 없는 값은 "-"', async () => {
    await renderHome()
    const measure = card('최근 측정')
    expect(await within(measure).findByText('72.5cm')).toBeVisible()
    expect(within(measure).getByText('-')).toBeVisible()
    expect(within(measure).getByText('2026. 10. 15. (목)').closest('p')).toHaveTextContent(
      '2026. 10. 15. (목) 측정',
    )
  })

  it('측정 기록이 없으면 기록하기 버튼으로 입력 시트를 연다', async () => {
    vi.mocked(fetchBodyMeasures).mockResolvedValue([])
    const { router } = await renderHome()
    await userEvent.click(
      await within(card('최근 측정')).findByRole('link', { name: '키·몸무게 기록하기' }),
    )
    expect(await screen.findByRole('dialog', { name: '키·몸무게 기록' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/growth/body')
  })
})

describe('카드별 추가·수정 (FR-HOME-05)', () => {
  it('빠른 기록을 제거하고 카드 5개를 승인된 순서로 보여 준다', async () => {
    await renderHome()
    expect(screen.queryByRole('region', { name: '빠른 기록' })).not.toBeInTheDocument()
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(['오늘의 식단', '오늘의 기록', '어젯밤 수면', '준비 목록', '최근 측정'])
    expect(
      within(card('오늘의 기록')).getByRole('button', { name: '성장 기록 추가' }),
    ).toBeVisible()
  })

  it.each(['단어', '행동', '표정'])(
    '%s 추가를 고르면 해당 입력을 열고 취소하면 홈으로 돌아온다',
    async (label) => {
      const { router } = await renderHome()
      await userEvent.click(
        within(card('오늘의 기록')).getByRole('button', { name: '성장 기록 추가' }),
      )
      const menu = await screen.findByRole('dialog', { name: '성장 기록' })
      await userEvent.click(within(menu).getByRole('link', { name: label }))
      const types = await screen.findByRole('radiogroup', { name: '유형' })
      expect(within(types).getByRole('radio', { name: label })).toBeChecked()
      await userEvent.click(screen.getByRole('button', { name: '취소' }))
      await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    },
  )

  it('성장 선택 메뉴를 취소·Escape로 닫으면 누른 버튼에 초점이 돌아온다', async () => {
    await renderHome()
    const button = within(card('오늘의 기록')).getByRole('button', { name: '성장 기록 추가' })
    for (const cancel of ['button', 'escape']) {
      await userEvent.click(button)
      const menu = await screen.findByRole('dialog', { name: '성장 기록' })
      expect(
        within(menu)
          .getAllByRole('link')
          .map((link) => link.textContent),
      ).toEqual(['단어', '행동', '표정'])
      if (cancel === 'button')
        await userEvent.click(within(menu).getByRole('button', { name: '취소' }))
      else await userEvent.keyboard('{Escape}')
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      await waitFor(() => expect(button).toHaveFocus())
    }
  })

  it('어젯밤 수면은 기존 기록을 수정하고 취소하면 홈으로 돌아온다', async () => {
    const { router } = await renderHome()
    await userEvent.click(
      within(card('어젯밤 수면')).getByRole('link', { name: '어젯밤 수면 수정' }),
    )
    expect(router.state.location.pathname).toBe('/sleep/s2')
    expect(await screen.findByLabelText('수면일')).toHaveValue('2026-10-21')
    expect(screen.getByLabelText('잠든 시간')).toHaveValue('21:00')
    await userEvent.click(screen.getByRole('button', { name: '취소' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  it('측정이 있어도 새 측정 입력을 열고 취소하면 홈으로 돌아온다', async () => {
    const { router } = await renderHome()
    await userEvent.click(
      within(card('최근 측정')).getByRole('link', { name: '키·몸무게 기록 추가' }),
    )
    const sheet = await screen.findByRole('dialog', { name: '키·몸무게 기록' })
    expect(within(sheet).getByLabelText('측정 날짜')).toHaveValue('2026-10-22')
    await userEvent.click(within(sheet).getByRole('button', { name: '취소' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })
})

describe('불러오기 실패', () => {
  it('안내하고, 다시 시도하면 실패한 정보만 다시 불러온다', async () => {
    vi.mocked(fetchSleepLogs).mockRejectedValueOnce(new Error('offline'))
    await renderHome()
    const banner = await screen.findByRole('alert')
    expect(within(card('어젯밤 수면')).getByText('불러오지 못했어요')).toBeVisible()
    await userEvent.click(within(banner).getByRole('button', { name: '다시 시도' }))
    expect(await within(card('어젯밤 수면')).findByText('11시간 50분')).toBeVisible()
    expect(fetchSleepLogs).toHaveBeenCalledTimes(2)
    expect(fetchMilestones).toHaveBeenCalledTimes(1)
  })
})

describe('오늘의 식단·끼니 추가', () => {
  const meal = (type: MealEntry['type']): MealEntry => ({
    id: type,
    date: '2026-10-22',
    type,
    eaten: false,
    intake: null,
    memo: null,
    foods: [{ id: null, name: '쌀죽' }],
    recipes: [],
  })

  it('식단이 비어 있으면 본문 버튼으로 끼니를 골라 입력하고 홈으로 돌아온다', async () => {
    const { router } = await renderHome()
    expect(fetchMealWeek).toHaveBeenCalledWith('2026-10-22', '2026-10-22')
    expect(
      within(card('오늘의 식단')).queryByRole('button', { name: '식단 추가' }),
    ).not.toBeInTheDocument()
    await userEvent.click(
      within(card('오늘의 식단')).getByRole('button', { name: '오늘 식단 기록하기' }),
    )
    const picker = await screen.findByRole('dialog', { name: '끼니 선택' })
    expect(
      within(picker)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['아침', '점심', '저녁', '간식'])
    await userEvent.click(within(picker).getByRole('link', { name: '점심' }))
    const sheet = await screen.findByRole('dialog', { name: '식단 기록' })
    expect(router.state.location.pathname + router.state.location.search).toBe(
      '/meals/week?date=2026-10-22&meal=lunch&record=new',
    )
    await userEvent.click(within(sheet).getByRole('button', { name: '취소' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  it.each([
    [['breakfast'], ['점심', '저녁', '간식']],
    [
      ['breakfast', 'lunch'],
      ['저녁', '간식'],
    ],
    [['breakfast', 'lunch', 'dinner'], ['간식']],
    [['breakfast', 'lunch', 'dinner', 'snack'], []],
  ] as const)('기록된 끼니 %s를 제외한 선택지만 표시한다', async (types, remaining) => {
    vi.mocked(fetchMealWeek).mockResolvedValue(types.map(meal))
    await renderHome()
    const button = within(card('오늘의 식단')).queryByRole('button', { name: '식단 추가' })
    if (remaining.length === 0) {
      expect(button).not.toBeInTheDocument()
      expect(within(card('오늘의 식단')).getAllByRole('link')).toHaveLength(4)
    } else {
      await userEvent.click(button!)
      const menu = await screen.findByRole('dialog', { name: '끼니 선택' })
      expect(
        within(menu)
          .getAllByRole('link')
          .map((link) => link.textContent),
      ).toEqual([...remaining])
      await userEvent.click(within(menu).getByRole('button', { name: '취소' }))
      await waitFor(() => expect(button).toHaveFocus())
    }
  })

  it('아침 이후 점심을 저장하면 홈에 반영되고 저녁·간식을 추가할 수 있다', async () => {
    const entries: MealEntry[] = [meal('breakfast')]
    vi.mocked(fetchMealWeek).mockImplementation(async () => [...entries])
    vi.mocked(saveMealEntry).mockImplementation(async (input) => {
      entries.push({ ...input, id: 'lunch' })
      return { id: 'lunch', firstTriedFoods: [] }
    })
    const { router } = await renderHome()
    await userEvent.click(within(card('오늘의 식단')).getByRole('button', { name: '식단 추가' }))
    const picker = await screen.findByRole('dialog', { name: '끼니 선택' })
    await userEvent.click(within(picker).getByRole('link', { name: '점심' }))
    const sheet = await screen.findByRole('dialog', { name: '식단 기록' })
    const result = await within(sheet).findByRole('list', { name: '음식 검색 결과' })
    await userEvent.click(within(result).getByRole('button', { name: /^쌀/ }))
    await userEvent.click(within(sheet).getByRole('button', { name: '저장' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    await screen.findByRole('region', { name: '오늘의 식단' })
    await within(card('오늘의 식단')).findByRole('link', { name: /점심/ })
    expect(saveMealEntry).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-10-22', type: 'lunch' }),
      undefined,
    )
    await userEvent.click(within(card('오늘의 식단')).getByRole('button', { name: '식단 추가' }))
    const remaining = await screen.findByRole('dialog', { name: '끼니 선택' })
    expect(
      within(remaining)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['저녁', '간식'])
  })

  it('계획·먹음 상태, 삭제된 항목 이름과 끼니 순서를 표시하고 수정 주소로 연결한다', async () => {
    vi.mocked(fetchMealWeek).mockResolvedValue([
      {
        id: 'dinner',
        date: '2026-10-22',
        type: 'dinner',
        eaten: true,
        intake: null,
        memo: null,
        foods: [{ id: null, name: '삭제된 음식' }],
        recipes: [],
      },
      {
        id: 'breakfast',
        date: '2026-10-22',
        type: 'breakfast',
        eaten: false,
        intake: null,
        memo: null,
        foods: [],
        recipes: [{ id: 'r1', name: '쌀죽' }],
      },
    ])
    await renderHome()
    const links = await within(card('오늘의 식단')).findAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual(['아침쌀죽계획', '저녁삭제된 음식먹음'])
    expect(links[0]).toHaveAttribute('href', '/meals/week?date=2026-10-22&record=breakfast')
  })
  it('오늘 식단 조회 실패 시 기존 카드는 유지하고 실패한 조회만 재시도한다', async () => {
    vi.mocked(fetchMealWeek).mockRejectedValueOnce(new Error('offline'))
    await renderHome()
    const alert = await screen.findByRole('alert')
    await userEvent.click(within(alert).getByRole('button', { name: '다시 시도' }))
    await within(card('오늘의 식단')).findByRole('button', { name: '오늘 식단 기록하기' })
    expect(fetchMealWeek).toHaveBeenCalledTimes(2)
    expect(fetchSleepLogs).toHaveBeenCalledTimes(1)
  })
})

// 홈은 미구매 개수만 요약하고 상세는 쇼핑 화면에서 확인한다.
it('빈 쇼핑 카드의 제목 아래 링크로 목록을 연다', async () => {
  const { router } = await renderHome()
  const region = card('준비 목록')
  expect(within(region).getByRole('heading', { name: '준비 목록' })).toBeVisible()
  await userEvent.click(within(region).getByRole('link', { name: /준비 목록 보기/ }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/preparation'))
})
it('쇼핑 카드는 미구매 개수만 표시하고 상세 목록으로 연결한다', async () => {
  vi.mocked(fetchTasks).mockResolvedValue([
    { id: 't1', name: '문화센터 등록', dueDate: null, memo: null, url: null, completed: false },
    { id: 't2', name: '완료한 일', dueDate: null, memo: null, url: null, completed: true },
  ])
  const base = {
    name: '가명 물건',
    category: 'books' as const,
    url: null,
    memo: null,
    frequent: true,
  }
  vi.mocked(fetchShoppingItems).mockResolvedValue([
    { ...base, id: 's1', name: '그림책', status: 'pending' },
    { ...base, id: 's4', name: '아기 내복', status: 'pending' },
    { ...base, id: 's2', name: '구매 완료한 물건', status: 'purchased' },
    { ...base, id: 's3', name: '보관 전용 물건', status: 'saved' },
  ])
  await renderHome()
  const region = within(card('준비 목록'))
  expect(await region.findByText('살 물건 2개')).toBeVisible()
  expect(region.getByText('할 일 1개')).toBeVisible()
  expect(region.queryByRole('list')).not.toBeInTheDocument()
  expect(region.queryByText('그림책')).not.toBeInTheDocument()
  expect(region.queryByText('아기 내복')).not.toBeInTheDocument()
  expect(region.queryByText('구매 완료한 물건')).not.toBeInTheDocument()
  expect(region.queryByText('보관 전용 물건')).not.toBeInTheDocument()
  expect(within(card('준비 목록')).getByRole('link', { name: /준비 목록 보기/ })).toHaveAttribute(
    'href',
    '/preparation',
  )
})

it('할 일 조회가 실패하면 0개로 표시하지 않고 실패한 조회만 재시도한다', async () => {
  vi.mocked(fetchTasks).mockRejectedValueOnce(new Error('offline'))
  await renderHome()
  const region = within(card('준비 목록'))
  const alert = await region.findByRole('alert')
  expect(region.queryByText('할 일 0개')).not.toBeInTheDocument()
  await userEvent.click(within(alert).getByRole('button', { name: '다시 시도' }))
  await region.findByText('할 일 0개')
  expect(fetchTasks).toHaveBeenCalledTimes(2)
  expect(fetchShoppingItems).toHaveBeenCalledTimes(1)
})
