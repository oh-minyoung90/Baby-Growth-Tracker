import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthState } from '@/lib/auth'
import { fetchMyChild } from '@/lib/childApi'
import {
  CautionSaveError,
  FoodSaveError,
  clearCautionTag,
  createFood,
  deleteFood,
  fetchFoods,
  releaseFoodCaution,
  seedDefaultFoods,
  setFoodCaution,
  updateFood,
  type Food,
} from '@/lib/foodApi'
import { fetchFoodMealCounts } from '@/lib/foodDetailApi'
import { renderApp } from '@/test/renderApp'

// 음식 목록 (T-37, SCR-10, FR-FOOD-01~08, R45)과 알러지·주의 지정·해제 (T-38, FR-FOOD-11~14, R48~49).
// 테스트 데이터는 가명이다.
// 서버 대신 메모리 목록(store)에 저장해, 저장 후 목록을 다시 불러오는 흐름까지 확인한다.

vi.mock('@/lib/foodDetailApi', () => ({ fetchFoodMealCounts: vi.fn() }))
vi.mock('@/lib/childApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/childApi')>()),
  fetchMyChild: vi.fn(),
}))
vi.mock('@/lib/foodApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/foodApi')>()),
  fetchFoods: vi.fn(),
  createFood: vi.fn(),
  updateFood: vi.fn(),
  deleteFood: vi.fn(),
  seedDefaultFoods: vi.fn(),
  setFoodCaution: vi.fn(),
  releaseFoodCaution: vi.fn(),
  clearCautionTag: vi.fn(),
}))

// jsdom에는 ResizeObserver가 없다. Radix 체크박스가 폼 안에서 크기를 잴 때 쓰므로 이 파일에서만 빈 구현을 둔다
// (전역에 두면 Recharts가 실제 크기(0)를 재려 해 차트 테스트가 그려지지 않는다)
beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})
afterAll(() => vi.unstubAllGlobals())

const auth: AuthState = { status: 'signedIn', session: { user: { id: 'u1' } } as Session }
let store: Food[] = []

function food(values: Partial<Food> & Pick<Food, 'id' | 'name'>): Food {
  return {
    group: 'vegetable',
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
    ...values,
  }
}

beforeEach(() => {
  // 오늘은 2026-10-22(목). 생년월일은 2026-01-08
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 22, 9, 0))
  vi.resetAllMocks()
  store = []
  vi.mocked(fetchFoodMealCounts).mockResolvedValue({})
  vi.mocked(fetchMyChild).mockResolvedValue({
    id: 'c1',
    nickname: '하늘이',
    birthDate: '2026-01-08',
  })
  vi.mocked(fetchFoods).mockImplementation(async () =>
    [...store].sort((a, b) => a.name.localeCompare(b.name, 'ko')),
  )
  vi.mocked(createFood).mockImplementation(async (input) => {
    const created = food({
      id: `f${store.length + 1}`,
      name: input.name,
      group: input.group,
      memo: input.memo,
      status: input.alreadyTried ? 'tried' : 'not_tried',
      manualTried: input.alreadyTried ?? false,
      manualFirstTriedDate: input.firstTriedDate,
      firstTriedDate: input.firstTriedDate,
      preference: input.preference,
    })
    store.push(created)
    return created
  })
  vi.mocked(updateFood).mockImplementation(async (id, input) => {
    const current = store.find((item) => item.id === id)
    if (!current) throw new Error('없음')
    const tried =
      input.alreadyTried === null
        ? {}
        : {
            status: input.alreadyTried ? ('tried' as const) : ('not_tried' as const),
            manualTried: input.alreadyTried,
            manualFirstTriedDate: input.firstTriedDate,
            firstTriedDate: input.firstTriedDate,
          }
    const updated = {
      ...current,
      name: input.name,
      group: input.group,
      memo: input.memo,
      preference: input.preference,
      ...tried,
    }
    store = store.map((item) => (item.id === id ? updated : item))
    return updated
  })
  vi.mocked(deleteFood).mockImplementation(async (id) => {
    store = store.filter((item) => item.id !== id)
  })
  // 알러지·주의 함수: DB 함수(T-38 마이그레이션)와 같은 결과를 메모리 목록에 반영한다
  const replace = (id: string, change: (current: Food) => Food) => {
    const current = store.find((item) => item.id === id)
    if (!current) throw new Error('없음')
    const updated = change(current)
    store = store.map((item) => (item.id === id ? updated : item))
    return updated
  }
  const noInfo = { reactionDate: null, symptomNote: null, checkNote: null }
  vi.mocked(setFoodCaution).mockImplementation(async (id, input) =>
    replace(id, (current) => ({ ...current, ...input, status: 'caution', cautionTag: false })),
  )
  vi.mocked(releaseFoodCaution).mockImplementation(async (id) =>
    replace(id, (current) => ({
      ...current,
      ...noInfo,
      status: current.manualTried ? 'tried' : 'not_tried',
    })),
  )
  vi.mocked(clearCautionTag).mockImplementation(async (id) =>
    replace(id, (current) => ({ ...current, ...noInfo, cautionTag: false })),
  )
  vi.mocked(seedDefaultFoods).mockImplementation(async () => {
    store.push(
      food({ id: 's1', name: '쌀', group: 'grain' }),
      food({ id: 's2', name: '애호박' }),
      food({ id: 's3', name: '사과', group: 'fruit' }),
    )
    return 3
  })
})
afterEach(() => vi.useRealTimers())

async function renderFoods(path = '/meals/foods') {
  const result = renderApp(path, auth)
  await screen.findByRole('heading', { name: '식사' })
  return result
}

function statusTab(name: RegExp) {
  return screen.getByRole('button', { name })
}

/** 탭에 맞는 추가 시트를 연다: 먹어봄 탭은 "먹어 본 음식 추가", 안 먹어봄 탭은 "안 먹어 본 음식 추가" (R47) */
async function openNewSheet(
  name: '먹어 본 음식 추가' | '안 먹어 본 음식 추가' = '먹어 본 음식 추가',
) {
  await userEvent.click(await screen.findByRole('button', { name }))
  return screen.findByRole('dialog', { name })
}

async function waitForSheetClosed() {
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
}

describe('음식이 하나도 없을 때 (FR-FOOD-07, R45)', () => {
  it('기본 음식을 추가할 수 있고, 추가하면 아직 안 먹어봄 탭을 보여 준다', async () => {
    const { router } = await renderFoods()
    expect(await screen.findByText('아직 음식이 없어요')).toBeInTheDocument()
    expect(statusTab(/^먹어봄 0개/)).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(screen.getByRole('button', { name: '기본 음식 추가' }))
    expect(await screen.findByText('기본 음식 3개를 추가했어요')).toBeInTheDocument()
    expect(seedDefaultFoods).toHaveBeenCalledTimes(1)
    // 탭 전환(주소 변경)은 알림보다 조금 늦게 반영될 수 있다
    await waitFor(() =>
      expect(statusTab(/^아직 안 먹어봄 3개/)).toHaveAttribute('aria-pressed', 'true'),
    )
    expect(router.state.location.search).toBe('?status=not_tried')
    const rows = within(await screen.findByRole('list', { name: '음식' })).getAllByRole('listitem')
    expect(rows.map((row) => row.querySelector('strong')?.textContent)).toEqual([
      '사과',
      '쌀',
      '애호박',
    ])
  })

  it('기본 음식 추가에 실패하면 안내하고 다시 시도할 수 있다', async () => {
    vi.mocked(seedDefaultFoods).mockRejectedValueOnce(new Error('network'))
    await renderFoods()
    await userEvent.click(await screen.findByRole('button', { name: '기본 음식 추가' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('저장하지 못했어요')
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByText('기본 음식 3개를 추가했어요')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('상태 탭과 탭별 표시 (FR-FOOD-01, 03, 14)', () => {
  beforeEach(() => {
    store = [
      food({
        id: 'a',
        name: '브로콜리',
        status: 'tried',
        manualTried: true,
        firstTriedDate: '2026-09-02',
        preference: 'like',
      }),
      food({
        id: 'b',
        name: '달걀노른자',
        group: 'protein',
        status: 'tried',
        cautionTag: true,
      }),
      food({ id: 'c', name: '블루베리', group: 'fruit', memo: '갈아서 시도\n2주 뒤' }),
      food({
        id: 'd',
        name: '땅콩',
        group: 'etc',
        status: 'caution',
        reactionDate: '2026-10-01',
        symptomNote: '입 주변 두드러기\n30분 후 사라짐',
      }),
    ]
  })

  it('탭마다 전체 개수를 보여 주고, 기본은 먹어봄이다', async () => {
    await renderFoods()
    await screen.findByRole('list', { name: '음식' })
    expect(statusTab(/^먹어봄 2개/)).toHaveAttribute('aria-pressed', 'true')
    expect(statusTab(/^아직 안 먹어봄 1개/)).toHaveAttribute('aria-pressed', 'false')
    expect(statusTab(/^알러지·주의 1개/)).toHaveAttribute('aria-pressed', 'false')
  })

  it('먹어봄: 식품군, 처음 먹은 날, 반응, "주의" 태그', async () => {
    await renderFoods()
    const [egg, broccoli] = within(await screen.findByRole('list', { name: '음식' })).getAllByRole(
      'listitem',
    )
    expect(egg).toHaveTextContent('달걀노른자')
    expect(egg).toHaveTextContent('주의')
    expect(egg).toHaveTextContent('육류·생선')
    expect(egg).toHaveTextContent('처음 먹은 날 모름')
    expect(egg).toHaveTextContent('반응 미입력')

    expect(broccoli).toHaveTextContent('채소')
    expect(broccoli).toHaveTextContent('처음 먹은 날 2026. 9. 2. (수)')
    expect(broccoli).toHaveTextContent('반응 좋아함')
    expect(broccoli).not.toHaveTextContent('주의')
  })

  it('아직 안 먹어봄: 식품군과 메모 첫 줄 / 알러지·주의: 반응 날짜와 증상 첫 줄', async () => {
    await renderFoods()
    await userEvent.click(await screen.findByRole('button', { name: /^아직 안 먹어봄/ }))
    const [berry] = within(screen.getByRole('list', { name: '음식' })).getAllByRole('listitem')
    expect(berry).toHaveTextContent('블루베리과일갈아서 시도')
    expect(berry).not.toHaveTextContent('2주 뒤')

    await userEvent.click(statusTab(/^알러지·주의/))
    const [peanut] = within(screen.getByRole('list', { name: '음식' })).getAllByRole('listitem')
    expect(peanut).toHaveTextContent('주의')
    expect(peanut).toHaveTextContent('반응 날짜 2026. 10. 1. (목)')
    expect(peanut).toHaveTextContent('입 주변 두드러기')
    expect(peanut).not.toHaveTextContent('30분 후')
    expect(peanut).not.toHaveTextContent('기타')
  })

  it('탭에 음식이 없으면 안내한다', async () => {
    store = store.filter((item) => item.status !== 'caution')
    await renderFoods('/meals/foods?status=caution')
    expect(await screen.findByText('알러지·주의 음식이 없어요')).toBeInTheDocument()
  })
})

describe('식품군 필터와 이름 검색 (FR-FOOD-02)', () => {
  beforeEach(() => {
    store = [
      food({ id: 'a', name: '단호박' }),
      food({ id: 'b', name: '애호박' }),
      food({ id: 'c', name: '사과', group: 'fruit' }),
      food({ id: 'd', name: 'Oat Milk', group: 'dairy' }),
    ]
  })

  function names() {
    return within(screen.getByRole('list', { name: '음식' }))
      .getAllByRole('listitem')
      .map((row) => row.querySelector('strong')?.textContent)
  }

  it('식품군을 고르면 그 식품군만 보이고, 주소에 남는다', async () => {
    const { router } = await renderFoods('/meals/foods?status=not_tried')
    await screen.findByRole('list', { name: '음식' })
    await userEvent.click(screen.getByRole('radio', { name: '과일' }))
    expect(names()).toEqual(['사과'])
    expect(router.state.location.search).toBe('?status=not_tried&group=fruit')
    await userEvent.click(screen.getByRole('radio', { name: '전체' }))
    expect(names()).toHaveLength(4)
  })

  it('이름 검색은 띄어쓰기·대소문자를 무시하고, 맞는 음식이 없으면 안내한다', async () => {
    await renderFoods('/meals/foods?status=not_tried')
    await screen.findByRole('list', { name: '음식' })
    await userEvent.type(screen.getByRole('searchbox', { name: '음식 이름 검색' }), '호박')
    expect(names()).toEqual(['단호박', '애호박'])
    await userEvent.clear(screen.getByRole('searchbox'))
    await userEvent.type(screen.getByRole('searchbox'), 'oatm')
    expect(names()).toEqual(['Oat Milk'])
    await userEvent.type(screen.getByRole('searchbox'), 'x')
    expect(screen.getByText('조건에 맞는 음식이 없어요')).toBeInTheDocument()
  })
})

describe('음식 추가: 탭이 추가할 음식을 정한다 (FR-FOOD-04~05, R47)', () => {
  beforeEach(() => {
    store = [food({ id: 'a', name: 'Oat Milk', group: 'dairy' })]
  })

  it('이름과 식품군은 필수다', async () => {
    await renderFoods()
    const sheet = await openNewSheet()
    await userEvent.click(within(sheet).getByRole('button', { name: '저장' }))
    expect(await within(sheet).findByText('음식 이름을 입력해 주세요')).toBeInTheDocument()
    expect(within(sheet).getByText('식품군을 골라 주세요')).toBeInTheDocument()
    expect(createFood).not.toHaveBeenCalled()
  })

  it('먹어봄 탭: 처음 먹은 날·반응(선택)과 함께 먹어봄으로 추가한다 (BR-17)', async () => {
    await renderFoods()
    const sheet = await openNewSheet('먹어 본 음식 추가')
    // 상태는 고르지 않는다
    expect(within(sheet).queryByRole('radiogroup', { name: '상태' })).toBeNull()
    await userEvent.type(within(sheet).getByLabelText('이름'), '쌀')
    await userEvent.click(within(sheet).getByRole('radio', { name: '곡류' }))
    const date = within(sheet).getByLabelText('처음 먹은 날 (선택)')
    expect(date).toHaveAttribute('min', '2026-01-08')
    expect(date).toHaveAttribute('max', '2026-10-22')

    // 미래 날짜는 받지 않는다
    fireEvent.change(date, { target: { value: '2026-10-23' } })
    await userEvent.click(within(sheet).getByRole('button', { name: '저장' }))
    expect(await within(sheet).findByText('오늘 이후 날짜는 고를 수 없어요')).toBeInTheDocument()

    fireEvent.change(date, { target: { value: '2026-07-01' } })
    await userEvent.click(within(sheet).getByRole('radio', { name: '매우 좋아함' }))
    await userEvent.click(within(sheet).getByRole('button', { name: '저장' }))
    expect(await screen.findByText('저장했어요')).toBeInTheDocument()
    expect(createFood).toHaveBeenCalledWith({
      name: '쌀',
      group: 'grain',
      memo: null,
      alreadyTried: true,
      firstTriedDate: '2026-07-01',
      preference: 'love',
    })
    await waitForSheetClosed()
    expect(statusTab(/^먹어봄 1개/)).toBeInTheDocument()
  })

  it('안 먹어봄 탭: 처음 먹은 날·반응 없이 아직 안 먹어봄으로 추가한다', async () => {
    const { router } = await renderFoods('/meals/foods?status=not_tried')
    const sheet = await openNewSheet('안 먹어 본 음식 추가')
    expect(within(sheet).queryByLabelText('처음 먹은 날 (선택)')).toBeNull()
    expect(within(sheet).queryByRole('radiogroup', { name: '아이 반응 (선택)' })).toBeNull()
    await userEvent.type(within(sheet).getByLabelText('이름'), ' 브로콜리 ')
    await userEvent.click(within(sheet).getByRole('radio', { name: '채소' }))
    await userEvent.type(within(sheet).getByLabelText('메모'), '찐 다음 다지기')
    await userEvent.click(within(sheet).getByRole('button', { name: '저장' }))

    expect(await screen.findByText('저장했어요')).toBeInTheDocument()
    expect(createFood).toHaveBeenCalledWith({
      name: '브로콜리',
      group: 'vegetable',
      memo: '찐 다음 다지기',
      alreadyTried: false,
      firstTriedDate: null,
      preference: null,
    })
    await waitForSheetClosed()
    expect(await screen.findByText('브로콜리')).toBeInTheDocument()
    expect(router.state.location.search).toBe('?status=not_tried')
  })

  it('알러지·주의 탭에는 추가 버튼이 없다 (지정은 음식마다, R48)', async () => {
    await renderFoods('/meals/foods?status=caution')
    await screen.findByText('알러지·주의 음식이 없어요')
    expect(screen.queryByRole('button', { name: /음식 추가$/ })).toBeNull()
  })

  it('먹어봄 탭에서 안 먹어봄에 있는 이름을 넣으면, 저장할 때 그 음식을 먹어봄으로 옮긴다', async () => {
    store = [food({ id: 'g', name: '귤', group: 'fruit', memo: '껍질 벗기기' })]
    const { router } = await renderFoods()
    const sheet = await openNewSheet('먹어 본 음식 추가')
    await userEvent.type(within(sheet).getByLabelText('이름'), '귤')
    expect(within(sheet).getByRole('status')).toHaveTextContent(
      "귤은 '아직 안 먹어봄'에 있어요. 저장하면 먹어봄으로 옮겨요",
    )
    // 식품군은 그 음식의 것으로 채운다
    expect(within(sheet).getByRole('radio', { name: '과일' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    fireEvent.change(within(sheet).getByLabelText('처음 먹은 날 (선택)'), {
      target: { value: '2026-09-01' },
    })
    await userEvent.click(within(sheet).getByRole('radio', { name: '좋아함' }))
    await userEvent.click(within(sheet).getByRole('button', { name: '저장' }))

    expect(await screen.findByText('저장했어요')).toBeInTheDocument()
    expect(createFood).not.toHaveBeenCalled()
    // 메모를 비워 두었으면 기존 메모를 남긴다
    expect(updateFood).toHaveBeenCalledWith('g', {
      name: '귤',
      group: 'fruit',
      memo: '껍질 벗기기',
      alreadyTried: true,
      firstTriedDate: '2026-09-01',
      preference: 'like',
    })
    await waitForSheetClosed()
    // 먹어봄 탭에 그대로 있고, 옮긴 음식이 보인다
    expect(router.state.location.search).toBe('')
    expect(statusTab(/^먹어봄 1개/)).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /귤/ })).toHaveTextContent('반응 좋아함')
  })

  it('그 밖에 같은 이름이 있으면 어느 목록에 있는지 알리고 저장하지 않는다 (BR-18)', async () => {
    await renderFoods('/meals/foods?status=not_tried')
    const sheet = await openNewSheet('안 먹어 본 음식 추가')
    await userEvent.type(within(sheet).getByLabelText('이름'), 'oat  milk')
    const notice = within(sheet).getByRole('status')
    expect(notice).toHaveTextContent('이미 있는 음식이에요')
    expect(notice).toHaveTextContent("Oat Milk은(는) '아직 안 먹어봄'에 있어요")

    await userEvent.click(within(sheet).getByRole('radio', { name: '유제품' }))
    await userEvent.click(within(sheet).getByRole('button', { name: '저장' }))
    expect(createFood).not.toHaveBeenCalled()
    expect(within(sheet).getByLabelText('이름')).toHaveFocus()

    // 이름을 바꾸면 안내가 사라진다
    await userEvent.type(within(sheet).getByLabelText('이름'), ' 라떼')
    expect(within(sheet).queryByRole('status')).toBeNull()
  })

  it('먹어 본 음식과 이름이 같으면 "이미 먹어 본 음식이에요"로 알린다', async () => {
    store = [food({ id: 'r', name: '쌀', group: 'grain', status: 'tried', manualTried: true })]
    await renderFoods()
    const sheet = await openNewSheet('먹어 본 음식 추가')
    await userEvent.type(within(sheet).getByLabelText('이름'), '쌀')
    expect(within(sheet).getByRole('status')).toHaveTextContent(
      "이미 먹어 본 음식이에요쌀은 '먹어봄'에 있어요",
    )
    await userEvent.click(within(sheet).getByRole('radio', { name: '곡류' }))
    await userEvent.click(within(sheet).getByRole('button', { name: '저장' }))
    expect(createFood).not.toHaveBeenCalled()
    expect(updateFood).not.toHaveBeenCalled()
  })

  it('"이 음식 열기"를 누르면 그 음식의 수정 시트로 바뀌고, 닫으면 목록으로 돌아간다', async () => {
    const { router } = await renderFoods('/meals/foods?status=not_tried')
    const sheet = await openNewSheet('안 먹어 본 음식 추가')
    await userEvent.type(within(sheet).getByLabelText('이름'), 'oat milk')
    await userEvent.click(within(sheet).getByRole('button', { name: '이 음식 열기' }))

    const edit = await screen.findByRole('dialog', { name: '음식 수정' })
    expect(within(edit).getByLabelText('이름')).toHaveValue('Oat Milk')
    expect(router.state.location.search).toBe('?status=not_tried&record=a')

    await userEvent.click(within(edit).getByRole('button', { name: '취소' }))
    await waitForSheetClosed()
    expect(router.state.location.search).toBe('?status=not_tried')
  })

  it('서버가 같은 이름으로 거부해도 같은 문구로 안내한다', async () => {
    vi.mocked(createFood).mockRejectedValueOnce(new FoodSaveError('duplicateName'))
    await renderFoods()
    const sheet = await openNewSheet()
    await userEvent.type(within(sheet).getByLabelText('이름'), '두부')
    await userEvent.click(within(sheet).getByRole('radio', { name: '기타' }))
    await userEvent.click(within(sheet).getByRole('button', { name: '저장' }))
    expect(await within(sheet).findByText('이미 있는 음식이에요')).toBeInTheDocument()
    expect(within(sheet).getByLabelText('이름')).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('음식 수정·삭제: 음식의 상태가 수정 시트 모양을 정한다 (FR-FOOD-04~06, 08, R45~47)', () => {
  beforeEach(() => {
    store = [
      food({ id: 'a', name: '애호박', memo: '껍질 벗기기' }),
      food({
        id: 'b',
        name: '땅콩',
        group: 'etc',
        status: 'caution',
        reactionDate: '2026-10-01',
        preference: 'refuse',
      }),
      food({
        id: 'c',
        name: '사과',
        group: 'fruit',
        status: 'tried',
        manualTried: true,
        manualFirstTriedDate: '2026-08-01',
        firstTriedDate: '2026-08-01',
        preference: 'love',
      }),
    ]
  })

  it('안 먹어봄 음식: 수정 시트는 날짜·반응 없이 열리고, 고친 내용을 저장한다', async () => {
    const { router } = await renderFoods('/meals/foods?status=not_tried&record=a')
    const sheet = await screen.findByRole('dialog', { name: '음식 수정' })
    expect(router.state.location.search).toBe('?status=not_tried&record=a')
    expect(within(sheet).getByLabelText('이름')).toHaveValue('애호박')
    expect(within(sheet).getByRole('radio', { name: '채소' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(within(sheet).getByLabelText('메모')).toHaveValue('껍질 벗기기')
    expect(within(sheet).queryByLabelText('처음 먹은 날 (선택)')).toBeNull()

    await userEvent.clear(within(sheet).getByLabelText('메모'))
    await userEvent.click(within(sheet).getByRole('button', { name: '저장' }))
    expect(await screen.findByText('저장했어요')).toBeInTheDocument()
    expect(updateFood).toHaveBeenCalledWith('a', {
      name: '애호박',
      group: 'vegetable',
      memo: null,
      alreadyTried: false,
      firstTriedDate: null,
      preference: null,
    })
    await waitForSheetClosed()
    expect(router.state.location.search).toBe('?status=not_tried')
  })

  it('안 먹어봄 음식을 "먹어봄으로 옮기기"로 옮길 수 있다', async () => {
    await renderFoods('/meals/foods?status=not_tried&record=a')
    const sheet = await screen.findByRole('dialog', { name: '음식 수정' })
    await userEvent.click(within(sheet).getByRole('button', { name: '먹어봄으로 옮기기' }))
    expect(within(sheet).getByRole('status')).toHaveTextContent('먹어봄으로 옮겨요')
    // 다시 누르면 옮기지 않는다
    await userEvent.click(within(sheet).getByRole('button', { name: '아직 안 먹어봄에 두기' }))
    expect(within(sheet).queryByRole('status')).toBeNull()
    await userEvent.click(within(sheet).getByRole('button', { name: '먹어봄으로 옮기기' }))

    fireEvent.change(within(sheet).getByLabelText('처음 먹은 날 (선택)'), {
      target: { value: '2026-09-01' },
    })
    await userEvent.click(within(sheet).getByRole('button', { name: '저장' }))
    expect(await screen.findByText('저장했어요')).toBeInTheDocument()
    expect(updateFood).toHaveBeenCalledWith(
      'a',
      expect.objectContaining({ alreadyTried: true, firstTriedDate: '2026-09-01' }),
    )
    await waitForSheetClosed()
    expect(statusTab(/^먹어봄 2개/)).toBeInTheDocument()
    expect(statusTab(/^아직 안 먹어봄 0개/)).toBeInTheDocument()
  })

  it('먹어봄 음식: 날짜·반응과 함께 열리고, 고른 반응을 다시 누르면 선택을 푼다 (R46)', async () => {
    await renderFoods('/meals/foods?record=c')
    const sheet = await screen.findByRole('dialog', { name: '음식 수정' })
    expect(within(sheet).getByLabelText('처음 먹은 날 (선택)')).toHaveValue('2026-08-01')
    const reaction = within(sheet).getByRole('radiogroup', { name: '아이 반응 (선택)' })
    expect(
      within(reaction)
        .getAllByRole('radio')
        .map((radio) => radio.textContent),
    ).toEqual(['매우 좋아함', '좋아함', '보통', '거부'])
    expect(within(reaction).getByRole('radio', { name: '매우 좋아함' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await userEvent.click(within(reaction).getByRole('radio', { name: '매우 좋아함' }))
    expect(within(reaction).getByRole('radio', { name: '매우 좋아함' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
    await userEvent.click(within(reaction).getByRole('radio', { name: '거부' }))
    await userEvent.click(within(sheet).getByRole('button', { name: '저장' }))
    expect(await screen.findByText('저장했어요')).toBeInTheDocument()
    expect(updateFood).toHaveBeenCalledWith('c', expect.objectContaining({ preference: 'refuse' }))
    await waitForSheetClosed()
    expect(screen.getByRole('button', { name: /사과/ })).toHaveTextContent('반응 거부')
  })

  it('먹어봄 음식을 "아직 안 먹어봄으로 옮기기"로 옮기면 날짜와 반응을 지운다', async () => {
    await renderFoods('/meals/foods?record=c')
    const sheet = await screen.findByRole('dialog', { name: '음식 수정' })
    await userEvent.click(within(sheet).getByRole('button', { name: '아직 안 먹어봄으로 옮기기' }))
    expect(within(sheet).getByRole('status')).toHaveTextContent(
      '저장하면 처음 먹은 날과 반응은 지워져요',
    )
    expect(within(sheet).queryByLabelText('처음 먹은 날 (선택)')).toBeNull()
    expect(within(sheet).queryByRole('radiogroup', { name: '아이 반응 (선택)' })).toBeNull()
    await userEvent.click(within(sheet).getByRole('button', { name: '저장' }))
    expect(await screen.findByText('저장했어요')).toBeInTheDocument()
    expect(updateFood).toHaveBeenCalledWith(
      'c',
      expect.objectContaining({ alreadyTried: false, firstTriedDate: null, preference: null }),
    )
  })

  it('알러지·주의 음식은 상태를 바꾸거나 반응을 묻지 않고, 저장된 반응은 그대로 둔다 (FR-FOOD-06)', async () => {
    await renderFoods('/meals/foods?status=caution&record=b')
    const sheet = await screen.findByRole('dialog', { name: '음식 수정' })
    expect(within(sheet).queryByRole('button', { name: /옮기기$/ })).toBeNull()
    expect(within(sheet).queryByRole('radiogroup', { name: '아이 반응 (선택)' })).toBeNull()
    await userEvent.clear(within(sheet).getByLabelText('이름'))
    await userEvent.type(within(sheet).getByLabelText('이름'), '땅콩버터')
    await userEvent.click(within(sheet).getByRole('button', { name: '저장' }))
    expect(await screen.findByText('저장했어요')).toBeInTheDocument()
    expect(updateFood).toHaveBeenCalledWith(
      'b',
      expect.objectContaining({ alreadyTried: null, preference: 'refuse' }),
    )
  })

  it('삭제하면 식단과 레시피에 이름이 남는다고 확인한 뒤 지운다 (FR-FOOD-08)', async () => {
    await renderFoods('/meals/foods?status=not_tried&record=a')
    const sheet = await screen.findByRole('dialog', { name: '음식 수정' })
    await userEvent.click(within(sheet).getByRole('button', { name: '삭제' }))
    const confirm = await screen.findByRole('alertdialog', { name: '이 음식을 삭제할까요?' })
    expect(confirm).toHaveTextContent('식단과 레시피에 적힌 이름은 그대로 남아요')
    await userEvent.click(within(confirm).getByRole('button', { name: '삭제' }))

    await waitForSheetClosed()
    expect(deleteFood).toHaveBeenCalledWith('a')
    expect(await screen.findByText('아직 안 먹어 본 음식이 없어요')).toBeInTheDocument()
  })
})

describe('알러지·주의 지정·해제 (FR-FOOD-11~14, BR-11, R48~49)', () => {
  beforeEach(() => {
    store = [
      food({ id: 'a', name: '달걀', group: 'protein' }),
      food({
        id: 'b',
        name: '땅콩',
        group: 'etc',
        status: 'caution',
        reactionDate: '2026-10-01',
        symptomNote: '입 주변 두드러기',
      }),
      food({
        id: 'c',
        name: '우유',
        group: 'dairy',
        status: 'caution',
        manualTried: true,
        manualFirstTriedDate: '2026-08-01',
        firstTriedDate: '2026-08-01',
        reactionDate: '2026-10-05',
      }),
      // 알러지·주의 음식을 식단에서 먹어 "주의" 태그가 붙은 음식 (T-40)
      food({
        id: 'd',
        name: '연어',
        group: 'protein',
        status: 'tried',
        cautionTag: true,
        firstTriedDate: '2026-10-10',
        reactionDate: '2026-09-20',
        symptomNote: '토함',
        checkNote: '소아과 진료',
      }),
    ]
  })

  it('수정 시트에서 [알러지·주의로 지정]을 누르면 지정 화면으로 바뀌고, 지정해도 보던 탭에 남는다', async () => {
    const { router } = await renderFoods('/meals/foods?status=not_tried')
    await act(async () => {
      await router.navigate('/meals/foods?status=not_tried&record=a')
    })
    await userEvent.click(
      within(await screen.findByRole('dialog', { name: '음식 수정' })).getByRole('button', {
        name: '알러지·주의로 지정',
      }),
    )

    const sheet = screen.getByRole('dialog', { name: '알러지·주의 지정' })
    expect(within(sheet).getByRole('status')).toHaveTextContent('달걀을 알러지·주의로 옮겨요')
    // 반응 날짜의 기본값은 오늘이다
    expect(within(sheet).getByLabelText('반응 날짜')).toHaveValue('2026-10-22')
    await userEvent.type(within(sheet).getByLabelText('증상 메모'), '입 주변이 빨개졌어요')
    await userEvent.type(within(sheet).getByLabelText('지정 사유 (선택)'), '소아과 권유')
    await userEvent.click(within(sheet).getByRole('button', { name: '지정' }))

    expect(await screen.findByText('달걀을 알러지·주의로 지정했어요')).toBeInTheDocument()
    expect(setFoodCaution).toHaveBeenCalledWith(
      'a',
      { reactionDate: '2026-10-22', symptomNote: '입 주변이 빨개졌어요', checkNote: null },
      '소아과 권유',
    )
    await waitForSheetClosed()
    expect(router.state.location.search).toBe('?status=not_tried')
    // 목록은 시트가 닫힌 뒤 다시 불러오므로 기다린다
    expect(await screen.findByText('아직 안 먹어 본 음식이 없어요')).toBeInTheDocument()
    expect(statusTab(/^알러지·주의 3개/)).toBeInTheDocument()
  })

  it('지정 화면에서 [취소]를 누르면 수정 화면으로 돌아간다', async () => {
    await renderFoods('/meals/foods?status=not_tried&record=a')
    const edit = await screen.findByRole('dialog', { name: '음식 수정' })
    await userEvent.click(within(edit).getByRole('button', { name: '알러지·주의로 지정' }))
    const sheet = screen.getByRole('dialog', { name: '알러지·주의 지정' })
    await userEvent.click(within(sheet).getByRole('button', { name: '취소' }))

    const back = screen.getByRole('dialog', { name: '음식 수정' })
    expect(within(back).getByLabelText('이름')).toHaveValue('달걀')
    expect(setFoodCaution).not.toHaveBeenCalled()
  })

  it('반응 날짜는 필수이고, 서버가 날짜를 거부하면 같은 칸에 알린다', async () => {
    await renderFoods('/meals/foods?status=not_tried&record=a')
    await userEvent.click(
      within(await screen.findByRole('dialog', { name: '음식 수정' })).getByRole('button', {
        name: '알러지·주의로 지정',
      }),
    )
    const sheet = screen.getByRole('dialog', { name: '알러지·주의 지정' })
    const date = within(sheet).getByLabelText('반응 날짜')
    fireEvent.change(date, { target: { value: '' } })
    await userEvent.click(within(sheet).getByRole('button', { name: '지정' }))
    // 빈 날짜칸에도 같은 안내가 보이므로 오류 문구만 찾는다
    expect(
      await within(sheet).findByText('날짜를 선택해 주세요', { selector: '[role=alert]' }),
    ).toBeInTheDocument()
    expect(setFoodCaution).not.toHaveBeenCalled()

    vi.mocked(setFoodCaution).mockRejectedValueOnce(new CautionSaveError('beforeBirth'))
    fireEvent.change(date, { target: { value: '2026-10-20' } })
    await userEvent.click(within(sheet).getByRole('button', { name: '지정' }))
    expect(
      await within(sheet).findByText('생년월일 이전 날짜는 고를 수 없어요'),
    ).toBeInTheDocument()
    expect(date).toHaveAttribute('aria-invalid', 'true')
  })

  it('알러지·주의 음식: 알러지·주의 정보를 함께 고치고, 바뀐 것만 저장한다', async () => {
    await renderFoods('/meals/foods?status=caution&record=b')
    const sheet = await screen.findByRole('dialog', { name: '음식 수정' })
    const info = within(sheet).getByRole('group', { name: '알러지·주의' })
    expect(within(info).getByLabelText('반응 날짜')).toHaveValue('2026-10-01')
    expect(within(info).getByLabelText('증상 메모')).toHaveValue('입 주변 두드러기')
    expect(within(sheet).queryByRole('button', { name: '알러지·주의로 지정' })).toBeNull()

    await userEvent.type(within(info).getByLabelText('확인 메모'), '소아과 진료')
    await userEvent.click(within(sheet).getByRole('button', { name: '저장' }))
    expect(await screen.findByText('저장했어요')).toBeInTheDocument()
    expect(setFoodCaution).toHaveBeenCalledWith('b', {
      reactionDate: '2026-10-01',
      symptomNote: '입 주변 두드러기',
      checkNote: '소아과 진료',
    })
    // 이름·식품군·메모는 그대로라 저장하지 않는다
    expect(updateFood).not.toHaveBeenCalled()
  })

  it('알러지·주의 해제: 먹은 기록이 없으면 아직 안 먹어봄으로 옮기고 사유를 남긴다 (FR-FOOD-12)', async () => {
    const { router } = await renderFoods('/meals/foods?status=caution&record=b')
    const sheet = await screen.findByRole('dialog', { name: '음식 수정' })
    await userEvent.click(within(sheet).getByRole('button', { name: '알러지·주의 해제' }))

    const confirm = await screen.findByRole('alertdialog', { name: '알러지·주의를 해제할까요?' })
    expect(confirm).toHaveTextContent('먹은 기록이 없어 아직 안 먹어봄으로 옮겨요')
    expect(confirm).toHaveTextContent('반응 날짜와 증상·확인 메모는 이력에 남아요')
    await userEvent.type(within(confirm).getByLabelText('사유 (선택)'), '다시 먹여 봐도 된대요')
    await userEvent.click(within(confirm).getByRole('button', { name: '해제' }))

    expect(await screen.findByText('땅콩을 아직 안 먹어봄으로 옮겼어요')).toBeInTheDocument()
    expect(releaseFoodCaution).toHaveBeenCalledWith('b', '다시 먹여 봐도 된대요')
    // 확인 창의 [해제]가 뒤의 수정 폼까지 저장하지 않는다
    expect(updateFood).not.toHaveBeenCalled()
    await waitForSheetClosed()
    expect(router.state.location.search).toBe('?status=caution')
    await waitFor(() => expect(statusTab(/^알러지·주의 1개/)).toBeInTheDocument())
  })

  it('먹은 기록이 있으면 먹어봄으로 옮긴다. 실패하면 창 안에서 알리고 다시 시도할 수 있다', async () => {
    vi.mocked(releaseFoodCaution).mockRejectedValueOnce(new CautionSaveError('network'))
    await renderFoods('/meals/foods?status=caution&record=c')
    const sheet = await screen.findByRole('dialog', { name: '음식 수정' })
    await userEvent.click(within(sheet).getByRole('button', { name: '알러지·주의 해제' }))

    const confirm = await screen.findByRole('alertdialog', { name: '알러지·주의를 해제할까요?' })
    expect(confirm).toHaveTextContent('먹은 기록이 있어 먹어봄으로 옮겨요')
    await userEvent.click(within(confirm).getByRole('button', { name: '해제' }))
    expect(await within(confirm).findByRole('alert')).toHaveTextContent('저장하지 못했어요')

    await userEvent.click(within(confirm).getByRole('button', { name: '해제' }))
    expect(await screen.findByText('우유를 먹어봄으로 옮겼어요')).toBeInTheDocument()
    expect(releaseFoodCaution).toHaveBeenCalledTimes(2)
    expect(releaseFoodCaution).toHaveBeenLastCalledWith('c', null)
    expect(updateFood).not.toHaveBeenCalled()
  })

  it('"주의" 태그 음식: 알러지·주의 정보를 보여 주고, 태그를 해제할 수 있다 (FR-FOOD-13~14)', async () => {
    await renderFoods('/meals/foods?record=d')
    const sheet = await screen.findByRole('dialog', { name: '음식 수정' })
    const info = within(sheet).getByRole('region', { name: '주의 정보' })
    expect(info).toHaveTextContent('2026. 9. 20. (일)')
    expect(info).toHaveTextContent('토함')
    expect(info).toHaveTextContent('소아과 진료')
    // 식단 기록으로 먹어봄이 된 음식이라 아직 안 먹어봄으로 옮기지 않는다
    expect(within(sheet).queryByRole('button', { name: '아직 안 먹어봄으로 옮기기' })).toBeNull()

    await userEvent.click(within(info).getByRole('button', { name: '"주의" 태그 해제' }))
    const confirm = await screen.findByRole('alertdialog', { name: '"주의" 태그를 해제할까요?' })
    expect(confirm).toHaveTextContent('먹어봄은 그대로예요')
    await userEvent.click(within(confirm).getByRole('button', { name: '해제' }))

    expect(await screen.findByText('연어의 "주의" 태그를 해제했어요')).toBeInTheDocument()
    expect(clearCautionTag).toHaveBeenCalledWith('d', null)
    expect(updateFood).not.toHaveBeenCalled()
    await waitForSheetClosed()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /연어/ })).not.toHaveTextContent('주의'),
    )
  })

  it('"주의" 태그 음식을 다시 지정하면 지금의 알러지·주의 정보를 이어서 쓴다', async () => {
    await renderFoods('/meals/foods?record=d')
    await userEvent.click(
      within(await screen.findByRole('dialog', { name: '음식 수정' })).getByRole('button', {
        name: '알러지·주의로 지정',
      }),
    )
    const sheet = screen.getByRole('dialog', { name: '알러지·주의 지정' })
    expect(within(sheet).getByLabelText('반응 날짜')).toHaveValue('2026-09-20')
    expect(within(sheet).getByLabelText('증상 메모')).toHaveValue('토함')
    expect(within(sheet).getByLabelText('확인 메모')).toHaveValue('소아과 진료')
  })
})
