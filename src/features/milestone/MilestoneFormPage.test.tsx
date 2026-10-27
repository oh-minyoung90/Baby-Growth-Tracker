import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthState } from '@/lib/auth'
import { fetchMyChild } from '@/lib/childApi'
import { renderApp } from '@/test/renderApp'
import {
  MilestoneSaveError,
  createMilestone,
  deleteMilestone,
  fetchMilestone,
  updateMilestone,
  type Milestone,
} from './milestoneApi'

// 발달 기록 입력·수정 (T-20, SCR-05, FR-MS-01~04, 07). 테스트 데이터는 가명이다.

vi.mock('@/lib/childApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/childApi')>()),
  fetchMyChild: vi.fn(),
}))
vi.mock('./milestoneApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./milestoneApi')>()),
  fetchMilestone: vi.fn(),
  createMilestone: vi.fn(),
  updateMilestone: vi.fn(),
  deleteMilestone: vi.fn(),
}))

const auth: AuthState = { status: 'signedIn', session: { user: { id: 'u1' } } as Session }
const saved: Milestone = {
  id: 'm1',
  type: 'expression',
  date: '2026-09-30',
  title: '소리 내어 웃기',
  memo: '목욕할 때',
}

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
  vi.mocked(fetchMilestone).mockResolvedValue(saved)
  vi.mocked(createMilestone).mockImplementation(async (input) => ({ id: 'new', ...input }))
  vi.mocked(updateMilestone).mockImplementation(async (id, input) => ({ id, ...input }))
  vi.mocked(deleteMilestone).mockResolvedValue()
})
afterEach(() => vi.useRealTimers())

/** 타임라인에서 입력 화면으로 이동한 상태로 시작한다 (저장 후 돌아갈 곳 확인용) */
async function openFrom(from: string, path: string) {
  const result = renderApp(from, auth)
  await screen.findByRole('heading', { level: 1 })
  await act(() => result.router.navigate(path))
  await screen.findByRole('heading', { level: 1, name: /발달 기록/ })
  return result
}

function typeRadio(name: string) {
  return within(screen.getByRole('radiogroup', { name: '유형' })).getByRole('radio', { name })
}

function titleInput() {
  return screen.getByLabelText('내용')
}

describe('새 기록 (FR-MS-01~04)', () => {
  it('유형을 고르지 않은 채 열리고, 비워 두고 저장하면 칸마다 안내한다', async () => {
    await openFrom('/timeline', '/milestones/new')
    for (const name of ['단어', '행동', '표정', '놀이']) {
      expect(typeRadio(name)).not.toBeChecked()
    }
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByText('유형을 골라 주세요')).toBeInTheDocument()
    expect(screen.getByText('내용을 입력해 주세요')).toBeInTheDocument()
    expect(createMilestone).not.toHaveBeenCalled()
  })

  it('빠른 기록에서 단어로 들어오면 단어가 골라져 있고, 예시는 보이지 않는다', async () => {
    await openFrom('/', '/milestones/new?type=word')
    expect(typeRadio('단어')).toBeChecked()
    expect(titleInput()).toHaveAttribute('placeholder', '예: 맘마')
    expect(screen.queryByRole('group', { name: '예시에서 고르기' })).not.toBeInTheDocument()
  })

  it('행동·표정·놀이는 기본 예시를 누르면 내용 칸에 채운다', async () => {
    await openFrom('/timeline', '/milestones/new')
    await userEvent.click(typeRadio('놀이'))
    const examples = screen.getByRole('group', { name: '예시에서 고르기' })
    expect(within(examples).getAllByRole('button')).toHaveLength(8)
    await userEvent.click(within(examples).getByRole('button', { name: '까꿍놀이' }))
    expect(titleInput()).toHaveValue('까꿍놀이')
  })

  it('날짜 아래에 생후 일수를 보여 주고, 날짜를 바꾸면 다시 계산한다 (FR-MS-03)', async () => {
    await openFrom('/timeline', '/milestones/new')
    expect(screen.getByText('생후 9개월 14일')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('날짜'), { target: { value: '2026-01-08' } })
    expect(await screen.findByText('생후 0일')).toBeInTheDocument()
  })

  it('저장하면 알림을 띄우고 진입했던 화면으로 돌아간다 (FR-MS-07)', async () => {
    const { router } = await openFrom('/timeline', '/milestones/new')
    await userEvent.click(typeRadio('행동'))
    await userEvent.type(titleInput(), '  잡고 서기 ')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    expect(await screen.findByText('저장했어요')).toBeInTheDocument()
    expect(createMilestone).toHaveBeenCalledWith({
      type: 'behavior',
      date: '2026-10-22',
      title: '잡고 서기',
      memo: null,
    })
    await waitFor(() => expect(router.state.location.pathname).toBe('/timeline'))
  })

  it('취소하면 저장하지 않고 진입했던 화면으로 돌아간다', async () => {
    const { router } = await openFrom('/', '/milestones/new?type=word')
    await userEvent.type(titleInput(), '맘마')
    await userEvent.click(screen.getByRole('button', { name: '취소' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(createMilestone).not.toHaveBeenCalled()
  })

  it.each([
    ['word', '/growth/words'],
    ['play', '/timeline'],
  ])('주소로 바로 들어왔으면(type=%s) 뒤로 가기는 %s로 간다', async (type, expected) => {
    const { router } = renderApp(`/milestones/new?type=${type}`, auth)
    await userEvent.click(await screen.findByRole('button', { name: '뒤로' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(expected))
  })

  it('입력 화면에서는 모바일 하단 탭을 숨긴다', async () => {
    await openFrom('/timeline', '/milestones/new')
    // PC 왼쪽 메뉴만 남는다 (jsdom에서는 화면 폭과 상관없이 둘 다 그려지므로 개수로 확인)
    expect(screen.getAllByRole('navigation', { name: '주 메뉴' })).toHaveLength(1)
  })
})

describe('수정·삭제 (FR-COM-30~31)', () => {
  it('저장한 값이 채워진 수정 화면이 열리고, 수정하면 같은 기록을 바꾼다', async () => {
    const { router } = await openFrom('/timeline', '/milestones/m1')
    expect(await screen.findByRole('heading', { name: '발달 기록 수정' })).toBeInTheDocument()
    expect(typeRadio('표정')).toBeChecked()
    expect(titleInput()).toHaveValue('소리 내어 웃기')
    expect(screen.getByLabelText('메모')).toHaveValue('목욕할 때')
    expect(screen.getByLabelText('날짜')).toHaveValue('2026-09-30')

    await userEvent.clear(titleInput())
    await userEvent.type(titleInput(), '깔깔 웃기')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByText('저장했어요')).toBeInTheDocument()
    expect(updateMilestone).toHaveBeenCalledWith('m1', {
      type: 'expression',
      date: '2026-09-30',
      title: '깔깔 웃기',
      memo: '목욕할 때',
    })
    await waitFor(() => expect(router.state.location.pathname).toBe('/timeline'))
  })

  it('삭제 확인 창을 거쳐 삭제하고 진입했던 화면으로 돌아간다', async () => {
    const { router } = await openFrom('/timeline', '/milestones/m1')
    await userEvent.click(await screen.findByRole('button', { name: '삭제' }))
    const dialog = await screen.findByRole('alertdialog', { name: '이 기록을 삭제할까요?' })
    await userEvent.click(within(dialog).getByRole('button', { name: '삭제' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/timeline'))
    expect(deleteMilestone).toHaveBeenCalledWith('m1')
  })

  it('없는 기록이면 안내한다', async () => {
    vi.mocked(fetchMilestone).mockResolvedValue(null)
    await openFrom('/timeline', '/milestones/unknown')
    expect(await screen.findByText(/기록을 찾을 수 없어요/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument()
  })
})

describe('저장 실패', () => {
  it('네트워크 오류면 상단에 안내하고, 입력값을 유지한 채 다시 시도할 수 있다', async () => {
    vi.mocked(createMilestone).mockRejectedValueOnce(new MilestoneSaveError('network'))
    await openFrom('/timeline', '/milestones/new?type=word')
    await userEvent.type(titleInput(), '맘마')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    const banner = await screen.findByRole('alert')
    expect(banner).toHaveTextContent('저장하지 못했어요. 인터넷 연결을 확인해 주세요')
    expect(titleInput()).toHaveValue('맘마')
    await userEvent.click(within(banner).getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByText('저장했어요')).toBeInTheDocument()
    expect(createMilestone).toHaveBeenCalledTimes(2)
  })

  it('서버 검증에 걸리면 화면 검증과 같은 칸에 같은 문구로 안내한다 (FR-COM-13)', async () => {
    vi.mocked(createMilestone).mockRejectedValueOnce(new MilestoneSaveError('futureDate'))
    await openFrom('/timeline', '/milestones/new?type=word')
    await userEvent.type(titleInput(), '맘마')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByText('오늘 이후 날짜는 고를 수 없어요')).toBeInTheDocument()
    expect(screen.getByLabelText('날짜')).toHaveAttribute('aria-invalid', 'true')
  })
})
