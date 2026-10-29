import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthState } from '@/lib/auth'
import { fetchMyChild } from '@/lib/childApi'
import {
  FoodSaveError,
  createFood,
  deleteFood,
  fetchFoods,
  seedDefaultFoods,
  updateFood,
  type Food,
} from '@/lib/foodApi'
import { renderApp } from '@/test/renderApp'

// 음식 목록 (T-37, SCR-10, FR-FOOD-01~08, R45). 테스트 데이터는 가명이다.
// 서버 대신 메모리 목록(store)에 저장해, 저장 후 목록을 다시 불러오는 흐름까지 확인한다.

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
    ...values,
  }
}

beforeEach(() => {
  // 오늘은 2026-10-22(목). 생년월일은 2026-01-08
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 22, 9, 0))
  vi.resetAllMocks()
  store = []
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

async function openNewSheet() {
  await userEvent.click(await screen.findByRole('button', { name: '음식 추가' }))
  return screen.findByRole('dialog', { name: '음식 추가' })
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

describe('음식 추가 (FR-FOOD-04~05)', () => {
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

  it('기본은 아직 안 먹어봄으로 추가하고, 시트를 닫은 뒤 목록에 반영한다', async () => {
    const { router } = await renderFoods('/meals/foods?status=not_tried')
    const sheet = await openNewSheet()
    await userEvent.type(within(sheet).getByLabelText('이름'), ' 브로콜리 ')
    await userEvent.click(within(sheet).getByRole('radio', { name: '채소' }))
    await userEvent.type(within(sheet).getByLabelText('메모'), '찐 다음 다지기')
    // 먹어 보지 않은 음식에는 처음 먹은 날과 반응을 묻지 않는다
    expect(within(sheet).queryByLabelText('처음 먹은 날 (선택)')).not.toBeInTheDocument()
    expect(within(sheet).queryByRole('radiogroup', { name: '아이 반응 (선택)' })).toBeNull()
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

  it('"이미 먹어 봤어요"를 고르면 처음 먹은 날(선택)을 넣을 수 있다 (BR-17)', async () => {
    await renderFoods()
    const sheet = await openNewSheet()
    await userEvent.type(within(sheet).getByLabelText('이름'), '쌀')
    await userEvent.click(within(sheet).getByRole('radio', { name: '곡류' }))
    await userEvent.click(within(sheet).getByRole('checkbox', { name: '이미 먹어 봤어요' }))
    const date = within(sheet).getByLabelText('처음 먹은 날 (선택)')
    expect(date).toHaveAttribute('min', '2026-01-08')
    expect(date).toHaveAttribute('max', '2026-10-22')

    // 미래 날짜는 받지 않는다
    fireEvent.change(date, { target: { value: '2026-10-23' } })
    await userEvent.click(within(sheet).getByRole('button', { name: '저장' }))
    expect(await within(sheet).findByText('오늘 이후 날짜는 고를 수 없어요')).toBeInTheDocument()

    fireEvent.change(date, { target: { value: '2026-07-01' } })
    // 먹어 본 음식이면 반응도 함께 고를 수 있다 (R46)
    await userEvent.click(within(sheet).getByRole('radio', { name: '매우 좋아함' }))
    await userEvent.click(within(sheet).getByRole('button', { name: '저장' }))
    expect(await screen.findByText('저장했어요')).toBeInTheDocument()
    expect(createFood).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '쌀',
        alreadyTried: true,
        firstTriedDate: '2026-07-01',
        preference: 'love',
      }),
    )
    await waitForSheetClosed()
    expect(statusTab(/^먹어봄 1개/)).toBeInTheDocument()
  })

  it('체크를 끄면 입력한 날짜도 지운다', async () => {
    await renderFoods()
    const sheet = await openNewSheet()
    const checkbox = within(sheet).getByRole('checkbox', { name: '이미 먹어 봤어요' })
    await userEvent.click(checkbox)
    fireEvent.change(within(sheet).getByLabelText('처음 먹은 날 (선택)'), {
      target: { value: '2026-07-01' },
    })
    await userEvent.click(checkbox)
    await userEvent.click(checkbox)
    expect(within(sheet).getByLabelText('처음 먹은 날 (선택)')).toHaveValue('')
  })

  it('같은 이름(띄어쓰기·대소문자 무시)이 있으면 저장하지 않고 안내한다 (BR-18)', async () => {
    await renderFoods()
    const sheet = await openNewSheet()
    await userEvent.type(within(sheet).getByLabelText('이름'), 'oat  milk')
    await userEvent.click(within(sheet).getByRole('radio', { name: '유제품' }))
    await userEvent.click(within(sheet).getByRole('button', { name: '저장' }))
    expect(await within(sheet).findByText('이미 있는 음식이에요')).toBeInTheDocument()
    expect(createFood).not.toHaveBeenCalled()
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

describe('음식 수정·삭제 (FR-FOOD-04~06, 08, R45)', () => {
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
        preference: 'love',
      }),
    ]
  })

  it('누르면 수정 시트가 열리고, 아직 안 먹어봄 음식을 "이미 먹어 봤어요"로 바꿀 수 있다', async () => {
    const { router } = await renderFoods('/meals/foods?status=not_tried')
    await userEvent.click(await screen.findByRole('button', { name: /애호박/ }))
    const sheet = await screen.findByRole('dialog', { name: '음식 수정' })
    expect(router.state.location.search).toBe('?status=not_tried&record=a')
    expect(within(sheet).getByLabelText('이름')).toHaveValue('애호박')
    expect(within(sheet).getByRole('radio', { name: '채소' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(within(sheet).getByLabelText('메모')).toHaveValue('껍질 벗기기')

    await userEvent.click(within(sheet).getByRole('checkbox', { name: '이미 먹어 봤어요' }))
    await userEvent.click(within(sheet).getByRole('button', { name: '저장' }))
    expect(await screen.findByText('저장했어요')).toBeInTheDocument()
    expect(updateFood).toHaveBeenCalledWith('a', {
      name: '애호박',
      group: 'vegetable',
      memo: '껍질 벗기기',
      alreadyTried: true,
      firstTriedDate: null,
      preference: null,
    })
    await waitForSheetClosed()
    expect(router.state.location.search).toBe('?status=not_tried')
    expect(statusTab(/^먹어봄 2개/)).toBeInTheDocument()
    expect(statusTab(/^아직 안 먹어봄 0개/)).toBeInTheDocument()
  })

  it('먹어 본 음식은 반응을 바꿀 수 있고, 고른 반응을 다시 누르면 선택을 푼다 (R46)', async () => {
    await renderFoods('/meals/foods?record=c')
    const sheet = await screen.findByRole('dialog', { name: '음식 수정' })
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

  it('"이미 먹어 봤어요"를 끄면 반응을 묻지 않고 지운다', async () => {
    await renderFoods('/meals/foods?record=c')
    const sheet = await screen.findByRole('dialog', { name: '음식 수정' })
    await userEvent.click(within(sheet).getByRole('checkbox', { name: '이미 먹어 봤어요' }))
    expect(
      within(sheet).queryByRole('radiogroup', { name: '아이 반응 (선택)' }),
    ).not.toBeInTheDocument()
    await userEvent.click(within(sheet).getByRole('button', { name: '저장' }))
    expect(await screen.findByText('저장했어요')).toBeInTheDocument()
    expect(updateFood).toHaveBeenCalledWith(
      'c',
      expect.objectContaining({ alreadyTried: false, preference: null }),
    )
  })

  it('알러지·주의 음식은 "이미 먹어 봤어요"를 묻지 않고 상태를 그대로 둔다 (FR-FOOD-06)', async () => {
    await renderFoods('/meals/foods?status=caution&record=b')
    const sheet = await screen.findByRole('dialog', { name: '음식 수정' })
    expect(within(sheet).queryByRole('checkbox')).not.toBeInTheDocument()
    await userEvent.clear(within(sheet).getByLabelText('이름'))
    await userEvent.type(within(sheet).getByLabelText('이름'), '땅콩버터')
    // 반응도 묻지 않고, 저장된 반응은 그대로 둔다
    expect(within(sheet).queryByRole('radiogroup', { name: '아이 반응 (선택)' })).toBeNull()
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
