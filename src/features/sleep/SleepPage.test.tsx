import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthState } from '@/lib/auth'
import { fetchMyChild } from '@/lib/childApi'
import { fetchSleepLogs, type SleepLog } from '@/lib/sleepApi'
import { renderApp } from '@/test/renderApp'

// 수면 목록 (T-27, SCR-08, FR-SLEEP-09). 테스트 데이터는 가명이다.

vi.mock('@/lib/childApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/childApi')>()),
  fetchMyChild: vi.fn(),
}))
vi.mock('@/lib/sleepApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/sleepApi')>()),
  fetchSleepLogs: vi.fn(),
}))

const auth: AuthState = { status: 'signedIn', session: { user: { id: 'u1' } } as Session }

// 서버가 수면일 최신순으로 준다
const logs: SleepLog[] = [
  {
    id: 's3',
    date: '2026-10-20',
    bedAt: '2026-10-20T21:00',
    wakeAt: '2026-10-21T06:30',
    naps: [
      { startAt: '2026-10-20T10:00', endAt: '2026-10-20T11:00' },
      { startAt: '2026-10-20T14:00', endAt: '2026-10-20T15:20' },
    ],
    memo: null,
  },
  {
    id: 's2',
    date: '2026-10-18',
    bedAt: '2026-10-18T21:30',
    wakeAt: null,
    naps: [{ startAt: '2026-10-18T13:00', endAt: '2026-10-18T14:00' }],
    memo: '뒤척임',
  },
  {
    id: 's1',
    date: '2026-10-17',
    bedAt: null,
    wakeAt: null,
    naps: [{ startAt: '2026-10-17T13:00', endAt: '2026-10-17T14:30' }],
    memo: null,
  },
]

beforeEach(() => {
  // 오늘은 2026-10-22(목). 생년월일은 2026-01-08
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 22, 8, 0))
  vi.resetAllMocks()
  vi.mocked(fetchMyChild).mockResolvedValue({
    id: 'c1',
    nickname: '하늘이',
    birthDate: '2026-01-08',
  })
  vi.mocked(fetchSleepLogs).mockResolvedValue(logs)
})
afterEach(() => vi.useRealTimers())

async function rows() {
  const list = await screen.findByRole('list', { name: '수면 기록' })
  return within(list).getAllByRole('link')
}

describe('수면 목록 (FR-SLEEP-09)', () => {
  it('수면일 최신순으로 수면일·밤잠·낮잠 횟수·총 수면을 보여 준다', async () => {
    renderApp('/sleep', auth)
    const [first, second, third] = await rows()
    expect(first).toHaveTextContent('2026. 10. 20. (화)')
    expect(first).toHaveTextContent('밤잠 9시간 30분 · 낮잠 2회 2시간 20분')
    expect(first).toHaveTextContent('총 수면11시간 50분')
    expect(second).toHaveTextContent('2026. 10. 18. (일)')
    expect(third).toHaveTextContent('2026. 10. 17. (토)')
  })

  it('잠든·일어난 시간 중 하나만 있으면 밤잠과 총 수면은 계산 불가로 보여 준다 (FR-SLEEP-06)', async () => {
    renderApp('/sleep', auth)
    const [, partial] = await rows()
    expect(partial).toHaveTextContent('밤잠 계산 불가 · 낮잠 1회 1시간')
    expect(partial).toHaveTextContent('총 수면계산 불가')
  })

  it('밤잠 기록 없이 낮잠만 있으면 총 수면은 낮잠 합계다 (BR-07)', async () => {
    renderApp('/sleep', auth)
    const [, , napsOnly] = await rows()
    expect(napsOnly).toHaveTextContent('밤잠 없음 · 낮잠 1회 1시간 30분')
    expect(napsOnly).toHaveTextContent('총 수면1시간 30분')
  })

  it('기록을 누르면 수정 화면이 열리고, 취소하면 목록으로 돌아온다 (FR-COM-30)', async () => {
    const { router } = renderApp('/sleep', auth)
    const [first] = await rows()
    await userEvent.click(first)
    expect(router.state.location.pathname).toBe('/sleep/s3')
    expect(await screen.findByRole('heading', { level: 1, name: '수면 기록 수정' })).toBeVisible()
    expect(screen.getByLabelText('잠든 시간')).toHaveValue('21:00')

    await userEvent.click(screen.getByRole('button', { name: '취소' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/sleep'))
    expect(await rows()).toHaveLength(3)
  })
})

describe('목록 상태 (FR-COM-20, 22)', () => {
  it('기록이 없으면 안내와 기록하기 버튼을 보여 준다', async () => {
    vi.mocked(fetchSleepLogs).mockResolvedValue([])
    const { router } = renderApp('/sleep', auth)
    expect(await screen.findByText('아직 수면 기록이 없어요')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: '기록하기' }))
    expect(router.state.location.pathname).toBe('/sleep/new')
  })

  it('불러오지 못하면 안내하고, 다시 시도할 수 있다', async () => {
    vi.mocked(fetchSleepLogs).mockRejectedValueOnce(new Error('offline'))
    renderApp('/sleep', auth)
    const banner = await screen.findByRole('alert')
    await userEvent.click(within(banner).getByRole('button', { name: '다시 시도' }))
    expect(await rows()).toHaveLength(3)
    expect(fetchSleepLogs).toHaveBeenCalledTimes(2)
  })
})
