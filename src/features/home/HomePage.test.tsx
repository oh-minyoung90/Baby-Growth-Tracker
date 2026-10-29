import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthState } from '@/lib/auth'
import { fetchBodyMeasures, type BodyMeasure } from '@/lib/bodyApi'
import { fetchMyChild } from '@/lib/childApi'
import { fetchMilestone, fetchMilestones, type Milestone } from '@/lib/milestoneApi'
import { fetchSleepLogs, type SleepLog } from '@/lib/sleepApi'
import { renderApp } from '@/test/renderApp'

// 홈 (T-28, SCR-03, FR-HOME-01~06). 테스트 데이터는 가명이다.

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
    expect(document.title).toBe('홈 · Baby Growth Tracker')
  })
})

describe('오늘의 기록 (FR-HOME-02, 06)', () => {
  it('기록 날짜가 오늘인 발달 기록만 유형과 함께 보여 준다', async () => {
    await renderHome()
    const today = card('오늘의 기록')
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

  it('오늘 기록이 없으면 첫 기록을 남겨 보라고 안내한다', async () => {
    vi.mocked(fetchMilestones).mockResolvedValue(milestones.slice(2))
    await renderHome()
    expect(await within(card('오늘의 기록')).findByText('오늘 첫 기록을 남겨 보세요')).toBeVisible()
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

describe('빠른 기록 (FR-HOME-05)', () => {
  function quick() {
    return card('빠른 기록')
  }

  it('단어·행동·표정·수면·키·몸무게 버튼 4개가 있다', async () => {
    await renderHome()
    expect(
      within(quick())
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['단어', '행동·표정', '수면', '키·몸무게'])
  })

  it('단어는 단어 유형을 고른 입력 화면을 열고, 취소하면 홈으로 돌아온다', async () => {
    const { router } = await renderHome()
    await userEvent.click(within(quick()).getByRole('link', { name: '단어' }))
    const types = await screen.findByRole('radiogroup', { name: '유형' })
    expect(within(types).getByRole('radio', { name: '단어' })).toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: '취소' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  it('행동·표정은 유형을 고르지 않은 입력 화면을 연다', async () => {
    await renderHome()
    await userEvent.click(within(quick()).getByRole('link', { name: '행동·표정' }))
    const types = await screen.findByRole('radiogroup', { name: '유형' })
    for (const radio of within(types).getAllByRole('radio')) expect(radio).not.toBeChecked()
  })

  it('수면은 수면 입력 화면을, 키·몸무게는 입력 시트를 열고 닫으면 홈으로 돌아온다', async () => {
    const { router } = await renderHome()
    await userEvent.click(within(quick()).getByRole('link', { name: '수면' }))
    expect(router.state.location.pathname).toBe('/sleep/new')
    await userEvent.click(await screen.findByRole('button', { name: '취소' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))

    await userEvent.click(await within(quick()).findByRole('link', { name: '키·몸무게' }))
    const sheet = await screen.findByRole('dialog', { name: '키·몸무게 기록' })
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
