import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthState } from '@/lib/auth'
import { fetchMyChild } from '@/lib/childApi'
import {
  SleepSaveError,
  createSleepLog,
  deleteSleepLog,
  fetchSleepLogs,
  updateSleepLog,
  type SleepLog,
} from '@/lib/sleepApi'
import { renderApp } from '@/test/renderApp'

// 수면 입력·수정 (T-26, SCR-08, FR-SLEEP-01~08). 테스트 데이터는 가명이다.

vi.mock('@/lib/childApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/childApi')>()),
  fetchMyChild: vi.fn(),
}))
vi.mock('@/lib/sleepApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/sleepApi')>()),
  fetchSleepLogs: vi.fn(),
  createSleepLog: vi.fn(),
  updateSleepLog: vi.fn(),
  deleteSleepLog: vi.fn(),
}))

const auth: AuthState = { status: 'signedIn', session: { user: { id: 'u1' } } as Session }

// 수면일 최신순. 어제(10/21)는 기록이 없다
const logs: SleepLog[] = [
  {
    id: 's2',
    date: '2026-10-20',
    bedAt: '2026-10-20T21:00',
    wakeAt: '2026-10-21T06:30',
    naps: [{ startAt: '2026-10-20T10:00', endAt: '2026-10-20T11:00' }],
    memo: null,
  },
  {
    id: 's1',
    date: '2026-10-18',
    bedAt: '2026-10-18T21:30',
    wakeAt: null,
    naps: [],
    memo: '뒤척임',
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
  vi.mocked(createSleepLog).mockImplementation(async (input) => ({ id: 'new', ...input }))
  vi.mocked(updateSleepLog).mockImplementation(async (id, input) => ({ id, ...input }))
  vi.mocked(deleteSleepLog).mockResolvedValue()
})
afterEach(() => vi.useRealTimers())

/** 수면 탭에서 입력 화면으로 이동한 상태로 시작한다 (저장 후 돌아갈 곳 확인용) */
async function openFrom(path: string) {
  const result = renderApp('/sleep', auth)
  await screen.findByRole('heading', { level: 1, name: '수면' })
  await act(() => result.router.navigate(path))
  await screen.findByLabelText('수면일')
  return result
}

function change(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

function heading() {
  return screen.getByRole('heading', { level: 1 }).textContent
}

function summary() {
  return screen.getByRole('region', { name: '총 수면 시간' })
}

describe('새 기록 (FR-SLEEP-01~05)', () => {
  it('수면일은 어제이고, 시각을 입력하면 붙은 날짜와 총 수면을 바로 보여 준다', async () => {
    const { router } = await openFrom('/sleep/new')
    expect(heading()).toBe('수면 기록')
    expect(screen.getByLabelText('수면일')).toHaveValue('2026-10-21')
    expect(screen.getByText('밤잠에 든 날이에요. 기본값은 어제예요')).toBeInTheDocument()

    change('잠든 시간', '21:30')
    change('일어난 시간', '07:10')
    expect(screen.getByText('→ 10. 21. (수) 21:30')).toBeInTheDocument()
    expect(screen.getByText('→ 10. 22. (목) 07:10')).toBeInTheDocument()
    expect(summary()).toHaveTextContent('밤잠 9시간 40분 + 낮잠 없음')
    expect(summary()).toHaveTextContent('총 9시간 40분')

    await userEvent.click(screen.getByRole('button', { name: '낮잠 추가' }))
    await userEvent.click(screen.getByRole('button', { name: '낮잠 추가' }))
    change('낮잠 1 시작', '14:30')
    change('낮잠 1 끝', '15:40')
    change('낮잠 2 시작', '10:00')
    change('낮잠 2 끝', '11:20')
    expect(summary()).toHaveTextContent('밤잠 9시간 40분 + 낮잠 2시간 30분 (2회)')
    expect(summary()).toHaveTextContent('총 12시간 10분')

    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByText('저장했어요')).toBeInTheDocument()
    expect(createSleepLog).toHaveBeenCalledWith({
      date: '2026-10-21',
      bedAt: '2026-10-21T21:30',
      wakeAt: '2026-10-22T07:10',
      naps: [
        { startAt: '2026-10-21T10:00', endAt: '2026-10-21T11:20' },
        { startAt: '2026-10-21T14:30', endAt: '2026-10-21T15:40' },
      ],
      memo: null,
    })
    await waitFor(() => expect(router.state.location.pathname).toBe('/sleep'))
  })

  it('잠든 시간만 있어도 저장하고, 밤잠은 계산 불가로 보여 준다 (FR-SLEEP-06)', async () => {
    await openFrom('/sleep/new')
    change('잠든 시간', '00:20')
    expect(screen.getByText('→ 10. 22. (목) 00:20')).toBeInTheDocument()
    expect(summary()).toHaveTextContent('밤잠 계산 불가 + 낮잠 없음')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    await waitFor(() =>
      expect(createSleepLog).toHaveBeenCalledWith(
        expect.objectContaining({ bedAt: '2026-10-22T00:20', wakeAt: null }),
      ),
    )
  })

  it('낮잠 줄을 지우면 나머지 줄이 남는다', async () => {
    await openFrom('/sleep/new')
    await userEvent.click(screen.getByRole('button', { name: '낮잠 추가' }))
    await userEvent.click(screen.getByRole('button', { name: '낮잠 추가' }))
    change('낮잠 2 시작', '13:00')
    await userEvent.click(screen.getByRole('button', { name: '낮잠 1 삭제' }))
    expect(screen.queryByLabelText('낮잠 2 시작')).not.toBeInTheDocument()
    expect(screen.getByLabelText('낮잠 1 시작')).toHaveValue('13:00')
  })
})

describe('오류 (FR-SLEEP-07)', () => {
  it('시간을 하나도 입력하지 않으면 저장하지 않고 안내한다', async () => {
    await openFrom('/sleep/new')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(
      await screen.findByText('잠든 시간, 일어난 시간, 낮잠 중 하나 이상 입력해 주세요'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('잠든 시간')).toHaveAttribute('aria-invalid', 'true')
    expect(createSleepLog).not.toHaveBeenCalled()
  })

  it('밤잠 범위·낮잠 겹침을 해당 칸 아래에 안내하고, 고치면 사라진다', async () => {
    await openFrom('/sleep/new')
    change('잠든 시간', '18:00')
    change('일어난 시간', '10:30')
    await userEvent.click(screen.getByRole('button', { name: '낮잠 추가' }))
    await userEvent.click(screen.getByRole('button', { name: '낮잠 추가' }))
    change('낮잠 1 시작', '10:00')
    change('낮잠 1 끝', '11:20')
    change('낮잠 2 시작', '11:00')
    change('낮잠 2 끝', '12:00')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    expect(await screen.findByText('밤잠은 1시간 이상 16시간 이하여야 해요')).toBeInTheDocument()
    expect(screen.getByLabelText('일어난 시간')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('낮잠 1, 낮잠 2: 시간이 서로 겹쳐요')).toBeInTheDocument()
    expect(screen.getByLabelText('낮잠 2 시작')).toHaveAttribute('aria-invalid', 'true')
    expect(createSleepLog).not.toHaveBeenCalled()

    change('일어난 시간', '07:00')
    change('낮잠 2 시작', '11:30')
    await waitFor(() =>
      expect(screen.queryByText('밤잠은 1시간 이상 16시간 이하여야 해요')).not.toBeInTheDocument(),
    )
    expect(screen.queryByText('낮잠 1, 낮잠 2: 시간이 서로 겹쳐요')).not.toBeInTheDocument()
  })

  it('같은 수면일 기록이 이미 있다고 서버가 거부하면 수면일 칸에 안내한다', async () => {
    vi.mocked(createSleepLog).mockRejectedValue(new SleepSaveError('duplicateDate'))
    await openFrom('/sleep/new')
    change('잠든 시간', '21:00')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByText('이 수면일에 이미 기록이 있어요')).toBeInTheDocument()
  })

  it('네트워크 오류면 입력값을 그대로 두고 다시 시도할 수 있다', async () => {
    vi.mocked(createSleepLog).mockRejectedValueOnce(new SleepSaveError('network'))
    await openFrom('/sleep/new')
    change('잠든 시간', '21:00')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    const banner = await screen.findByRole('alert')
    expect(banner).toHaveTextContent('저장하지 못했어요')
    expect(screen.getByLabelText('잠든 시간')).toHaveValue('21:00')
    await userEvent.click(within(banner).getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(createSleepLog).toHaveBeenCalledTimes(2))
  })
})

describe('수면일당 1건 (FR-SLEEP-08)', () => {
  it('고른 수면일에 기록이 있으면 불러와 수정하고, 없는 날로 바꾸면 새 기록이다', async () => {
    await openFrom('/sleep/new')
    change('수면일', '2026-10-20')
    expect(heading()).toBe('수면 기록 수정')
    expect(screen.getByText('이 수면일에 기록이 있어 불러왔어요')).toBeInTheDocument()
    expect(screen.getByLabelText('잠든 시간')).toHaveValue('21:00')
    expect(screen.getByLabelText('일어난 시간')).toHaveValue('06:30')
    expect(screen.getByLabelText('낮잠 1 시작')).toHaveValue('10:00')

    change('수면일', '2026-10-19')
    expect(heading()).toBe('수면 기록')
    expect(screen.getByLabelText('잠든 시간')).toHaveValue('')
    expect(screen.queryByLabelText('낮잠 1 시작')).not.toBeInTheDocument()
  })

  it('불러온 기록을 저장하면 그 기록을 수정한다', async () => {
    const { router } = await openFrom('/sleep/new?date=2026-10-20')
    expect(heading()).toBe('수면 기록 수정')
    change('일어난 시간', '07:00')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    await waitFor(() =>
      expect(updateSleepLog).toHaveBeenCalledWith('s2', {
        date: '2026-10-20',
        bedAt: '2026-10-20T21:00',
        wakeAt: '2026-10-21T07:00',
        naps: [{ startAt: '2026-10-20T10:00', endAt: '2026-10-20T11:00' }],
        memo: null,
      }),
    )
    expect(createSleepLog).not.toHaveBeenCalled()
    await waitFor(() => expect(router.state.location.pathname).toBe('/sleep'))
  })

  it('기록이 없는 날에 새로 입력하던 값은 다른 빈 날로 바꿔도 남는다', async () => {
    await openFrom('/sleep/new')
    change('잠든 시간', '21:10')
    change('수면일', '2026-10-19')
    expect(heading()).toBe('수면 기록')
    expect(screen.getByLabelText('잠든 시간')).toHaveValue('21:10')
    expect(screen.getByText('→ 10. 19. (월) 21:10')).toBeInTheDocument()
  })

  it('수정 화면에서 기록이 없는 날로 바꾸면 그 기록의 수면일을 옮긴다', async () => {
    await openFrom('/sleep/s1')
    expect(heading()).toBe('수면 기록 수정')
    expect(screen.getByLabelText('메모')).toHaveValue('뒤척임')
    change('수면일', '2026-10-17')
    expect(screen.getByText('저장하면 이 기록의 수면일을 옮겨요')).toBeInTheDocument()
    expect(screen.getByLabelText('잠든 시간')).toHaveValue('21:30')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    await waitFor(() =>
      expect(updateSleepLog).toHaveBeenCalledWith('s1', {
        date: '2026-10-17',
        bedAt: '2026-10-17T21:30',
        wakeAt: null,
        naps: [],
        memo: '뒤척임',
      }),
    )
  })
})

describe('수정·삭제와 화면 이동', () => {
  it('삭제 확인 창을 거쳐 삭제하고 진입했던 화면으로 돌아간다', async () => {
    const { router } = await openFrom('/sleep/s2')
    await userEvent.click(screen.getByRole('button', { name: '삭제' }))
    const dialog = await screen.findByRole('alertdialog', { name: '이 기록을 삭제할까요?' })
    await userEvent.click(within(dialog).getByRole('button', { name: '삭제' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/sleep'))
    expect(deleteSleepLog).toHaveBeenCalledWith('s2')
  })

  it('새 기록에는 삭제 버튼이 없다', async () => {
    await openFrom('/sleep/new')
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument()
  })

  it('없는 기록이면 안내한다', async () => {
    renderApp('/sleep/unknown', auth)
    expect(await screen.findByText(/기록을 찾을 수 없어요/)).toBeInTheDocument()
  })

  it('수면 탭의 추가 버튼으로 입력 화면을 열고, 취소하면 돌아간다', async () => {
    const { router } = renderApp('/sleep', auth)
    await userEvent.click(await screen.findByRole('button', { name: '수면 기록 추가' }))
    expect(await screen.findByLabelText('수면일')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/sleep/new')
    // 입력 화면에서는 모바일 하단 탭을 숨긴다
    expect(screen.getAllByRole('navigation', { name: '주 메뉴' })).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: '취소' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/sleep'))
  })
})
