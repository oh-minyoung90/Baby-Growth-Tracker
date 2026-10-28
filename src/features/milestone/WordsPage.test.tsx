import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthState } from '@/lib/auth'
import { fetchMyChild } from '@/lib/childApi'
import { renderApp } from '@/test/renderApp'
import { fetchMilestone, fetchMilestones, type Milestone } from './milestoneApi'

// 성장 > 단어 (T-22, SCR-06, FR-WORD-01~03). 테스트 데이터는 가명이다.

vi.mock('@/lib/childApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/childApi')>()),
  fetchMyChild: vi.fn(),
}))
vi.mock('./milestoneApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./milestoneApi')>()),
  fetchMilestones: vi.fn(),
  fetchMilestone: vi.fn(),
}))

const auth: AuthState = { status: 'signedIn', session: { user: { id: 'u1' } } as Session }

function word(id: string, date: string, title: string): Milestone {
  return { id, type: 'word', date, title, memo: null }
}

// 날짜 최신순. "맘마"는 두 번, "엄마"는 띄어쓰기·대소문자만 다르게 두 번 기록했다
const records: Milestone[] = [
  word('w5', '2026-10-19', '맘마 '),
  { id: 'b1', type: 'behavior', date: '2026-10-16', title: '잡고 서기', memo: null },
  word('w4', '2026-10-14', '아빠'),
  word('w3', '2026-09-15', 'Bye bye'),
  word('w2', '2026-09-02', '맘마'),
  word('w1', '2026-08-20', '네'),
]

beforeEach(() => {
  // 오늘은 2026-10-22(목). 생년월일은 2026-01-08
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 22, 9, 0))
  vi.resetAllMocks()
  vi.mocked(fetchMyChild).mockResolvedValue({
    id: 'c1',
    nickname: '하늘이',
    birthDate: '2026-01-08',
  })
  vi.mocked(fetchMilestones).mockResolvedValue(records)
  vi.mocked(fetchMilestone).mockImplementation(
    async (id) => records.find((record) => record.id === id) ?? null,
  )
})
afterEach(() => vi.useRealTimers())

async function renderWords(path = '/growth/words') {
  const result = renderApp(path, auth)
  await screen.findByText('말할 수 있는 단어')
  return result
}

function wordRows() {
  return within(screen.getByRole('list')).getAllByRole('link')
}

function rowTitles() {
  return wordRows().map((row) => row.firstChild?.textContent)
}

describe('단어 수와 목록 (FR-WORD-01~02)', () => {
  it('같은 단어는 1개로 세고, 단어가 아닌 기록은 세지 않는다 (BR-03)', async () => {
    await renderWords()
    expect(screen.getByText('4개')).toBeInTheDocument()
    expect(screen.getByText('같은 단어는 1개로 셉니다')).toBeInTheDocument()
    expect(screen.queryByText('잡고 서기')).not.toBeInTheDocument()
  })

  it('단어마다 처음 기록한 날짜와 그날의 생후 일수를 보여 준다', async () => {
    await renderWords()
    const mamma = wordRows().find((row) => row.textContent?.startsWith('맘마'))
    expect(mamma).toHaveTextContent('맘마2026. 9. 2. (수)생후 7개월 25일')
    expect(mamma).toHaveAttribute('href', '/milestones/w2')
  })

  it('기본은 최근순(처음 기록한 날짜 최신순)이고, 가나다순으로 바꿀 수 있다', async () => {
    const { router } = await renderWords()
    expect(screen.getByRole('radio', { name: '최근순' })).toBeChecked()
    expect(rowTitles()).toEqual(['아빠', 'Bye bye', '맘마', '네'])

    await userEvent.click(screen.getByRole('radio', { name: '가나다순' }))
    expect(rowTitles()).toEqual(['네', '맘마', '아빠', 'Bye bye'])
    expect(router.state.location.search).toBe('?sort=name')

    await userEvent.click(screen.getByRole('radio', { name: '최근순' }))
    expect(rowTitles()).toEqual(['아빠', 'Bye bye', '맘마', '네'])
    expect(router.state.location.search).toBe('')
  })

  it('단어를 누르면 수정 화면이 열리고, 취소하면 정렬을 유지한 채 돌아온다 (FR-COM-30)', async () => {
    const { router } = await renderWords('/growth/words?sort=name')
    await userEvent.click(screen.getByRole('link', { name: /^아빠/ }))
    expect(await screen.findByRole('heading', { name: '발달 기록 수정' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/milestones/w4')

    await userEvent.click(await screen.findByRole('button', { name: '취소' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/growth/words'))
    expect(router.state.location.search).toBe('?sort=name')
    expect(await screen.findByRole('radio', { name: '가나다순' })).toBeChecked()
  })
})

describe('단어 추가 (FR-WORD-03)', () => {
  it('추가 버튼을 누르면 단어가 골라진 입력 화면이 열린다', async () => {
    const { router } = await renderWords()
    await userEvent.click(screen.getByRole('button', { name: '단어 추가' }))
    await screen.findByRole('heading', { name: '발달 기록' })
    expect(router.state.location.pathname + router.state.location.search).toBe(
      '/milestones/new?type=word',
    )
    expect(screen.getByRole('radio', { name: '단어' })).toBeChecked()
  })
})

describe('0건·불러오기 실패 (FR-COM-20~22)', () => {
  it('단어가 없으면 안내와 기록하기 버튼을 보여 준다', async () => {
    vi.mocked(fetchMilestones).mockResolvedValue([records[1]])
    const { router } = renderApp('/growth/words', auth)
    expect(await screen.findByText('아직 기록한 단어가 없어요')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: '기록하기' }))
    await waitFor(() =>
      expect(router.state.location.pathname + router.state.location.search).toBe(
        '/milestones/new?type=word',
      ),
    )
  })

  it('불러오지 못하면 안내하고, 다시 시도할 수 있다', async () => {
    vi.mocked(fetchMilestones).mockRejectedValueOnce(new Error('offline'))
    renderApp('/growth/words', auth)
    const banner = await screen.findByRole('alert')
    await userEvent.click(within(banner).getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByText('4개')).toBeInTheDocument()
  })
})
