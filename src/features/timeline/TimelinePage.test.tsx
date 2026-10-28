import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthState } from '@/lib/auth'
import { fetchBodyMeasures, type BodyMeasure } from '@/lib/bodyApi'
import { fetchMyChild } from '@/lib/childApi'
import { fetchMilestone, fetchMilestones, type Milestone } from '@/lib/milestoneApi'
import { renderApp } from '@/test/renderApp'

// 타임라인 (T-23, SCR-07, FR-TL-01~05, 07). 테스트 데이터는 가명이다.

vi.mock('@/lib/childApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/childApi')>()),
  fetchMyChild: vi.fn(),
}))
vi.mock('@/lib/milestoneApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/milestoneApi')>()),
  fetchMilestones: vi.fn(),
  fetchMilestone: vi.fn(),
}))
vi.mock('@/lib/bodyApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/bodyApi')>()),
  fetchBodyMeasures: vi.fn(),
}))

const auth: AuthState = { status: 'signedIn', session: { user: { id: 'u1' } } as Session }

// 날짜 최신순
const milestones: Milestone[] = [
  { id: 'w2', type: 'word', date: '2026-10-19', title: '네', memo: null },
  { id: 'e1', type: 'expression', date: '2026-10-03', title: '소리 내어 웃기', memo: '까꿍놀이' },
  { id: 'b1', type: 'behavior', date: '2026-09-16', title: '잡고 서기', memo: null },
  { id: 'w1', type: 'word', date: '2026-09-02', title: '엄마', memo: null },
]
const measures: BodyMeasure[] = [
  { id: 'm1', date: '2026-09-30', heightCm: 72.1, weightKg: 8.9, memo: '영유아 검진' },
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
  vi.mocked(fetchMilestones).mockResolvedValue(milestones)
  vi.mocked(fetchMilestone).mockImplementation(
    async (id) => milestones.find((record) => record.id === id) ?? null,
  )
  vi.mocked(fetchBodyMeasures).mockResolvedValue(measures)
})
afterEach(() => vi.useRealTimers())

async function renderTimeline(path = '/timeline') {
  const result = renderApp(path, auth)
  await screen.findByRole('group', { name: '유형' })
  return result
}

/** 화면에 보이는 기록 내용 (위에서부터) */
function titles() {
  return screen.queryAllByRole('link').flatMap((link) => {
    const title = link.querySelector('strong')
    return title ? [title.textContent] : []
  })
}

function typeChip(name: string) {
  return within(screen.getByRole('group', { name: '유형' })).getByRole('button', { name })
}

function periodChip(name: string) {
  return within(screen.getByRole('radiogroup', { name: '기간' })).getByRole('radio', { name })
}

describe('목록 (FR-TL-01~02, 07)', () => {
  it('발달 기록과 키·몸무게를 날짜 최신순으로, 월별로 묶어 보여 준다', async () => {
    await renderTimeline()
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      '2026년 10월',
      '2026년 9월',
    ])
    expect(titles()).toEqual(['네', '소리 내어 웃기', '72.1cm · 8.9kg', '잡고 서기', '엄마'])
    const october = screen.getByRole('region', { name: '2026년 10월' })
    expect(within(october).getAllByRole('listitem')).toHaveLength(2)
  })

  it('항목마다 유형, 날짜·생후 일수, 내용, 메모를 보여 준다', async () => {
    await renderTimeline()
    const row = screen.getByRole('link', { name: /소리 내어 웃기/ })
    expect(row).toHaveTextContent('표정')
    expect(row).toHaveTextContent('2026. 10. 3. (토) · 생후 8개월 25일')
    expect(row).toHaveTextContent('까꿍놀이')
    expect(screen.getByRole('link', { name: /72\.1cm/ })).toHaveTextContent('키·몸무게')
  })

  it('발달 기록을 누르면 수정 화면이 열리고, 취소하면 필터를 유지한 채 돌아온다', async () => {
    const { router } = await renderTimeline('/timeline?types=word,expression')
    await userEvent.click(screen.getByRole('link', { name: /소리 내어 웃기/ }))
    expect(await screen.findByRole('heading', { name: '발달 기록 수정' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/milestones/e1')

    await userEvent.click(await screen.findByRole('button', { name: '취소' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/timeline'))
    expect(router.state.location.search).toBe('?types=word,expression')
    expect(await screen.findByRole('button', { name: '행동' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('키·몸무게를 누르면 측정 수정 시트가 열린다', async () => {
    const { router } = await renderTimeline()
    await userEvent.click(screen.getByRole('link', { name: /72\.1cm/ }))
    expect(await screen.findByRole('dialog', { name: '키·몸무게 수정' })).toBeInTheDocument()
    expect(router.state.location.pathname + router.state.location.search).toBe(
      '/growth/body?record=m1',
    )
  })
})

describe('필터 (FR-TL-03~05)', () => {
  it('기본은 모든 유형·전체 기간이고, 유형을 끄고 켤 수 있다', async () => {
    const { router } = await renderTimeline()
    for (const name of ['단어', '행동', '표정', '놀이', '키·몸무게']) {
      expect(typeChip(name)).toHaveAttribute('aria-pressed', 'true')
    }
    expect(periodChip('전체')).toBeChecked()

    await userEvent.click(typeChip('단어'))
    expect(typeChip('단어')).toHaveAttribute('aria-pressed', 'false')
    expect(titles()).toEqual(['소리 내어 웃기', '72.1cm · 8.9kg', '잡고 서기'])
    expect(router.state.location.search).toBe('?types=behavior%2Cexpression%2Cplay%2Cmeasure')

    await userEvent.click(typeChip('단어'))
    expect(titles()).toHaveLength(5)
    expect(router.state.location.search).toBe('')
  })

  it('이번 달·지난 달로 기간을 고른다', async () => {
    await renderTimeline()
    await userEvent.click(periodChip('이번 달'))
    expect(titles()).toEqual(['네', '소리 내어 웃기'])
    await userEvent.click(periodChip('지난 달'))
    expect(titles()).toEqual(['72.1cm · 8.9kg', '잡고 서기', '엄마'])
  })

  it('직접 선택은 이번 달 1일~오늘로 시작하고, 시작일·종료일을 바꿀 수 있다', async () => {
    const { router } = await renderTimeline()
    await userEvent.click(periodChip('직접 선택'))
    expect(screen.getByLabelText('시작일')).toHaveValue('2026-10-01')
    expect(screen.getByLabelText('종료일')).toHaveValue('2026-10-22')
    expect(titles()).toEqual(['네', '소리 내어 웃기'])

    fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2026-09-16' } })
    fireEvent.change(screen.getByLabelText('종료일'), { target: { value: '2026-09-30' } })
    expect(titles()).toEqual(['72.1cm · 8.9kg', '잡고 서기'])
    expect(router.state.location.search).toBe('?period=custom&from=2026-09-16&to=2026-09-30')
  })

  it('종료일이 시작일보다 빠르면 종료일 아래에 안내한다', async () => {
    await renderTimeline('/timeline?period=custom&from=2026-10-10&to=2026-10-01')
    expect(screen.getByText('종료일은 시작일 이후로 골라 주세요')).toBeInTheDocument()
    expect(screen.getByLabelText('종료일')).toHaveAttribute('aria-invalid', 'true')
  })

  it('결과가 없으면 안내하고, 필터 초기화로 전체를 다시 보여 준다', async () => {
    const { router } = await renderTimeline('/timeline?types=play')
    expect(screen.getByText('조건에 맞는 기록이 없어요')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '필터 초기화' }))
    expect(titles()).toHaveLength(5)
    expect(router.state.location.search).toBe('')
    expect(typeChip('놀이')).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('0건·불러오기 실패 (FR-COM-20~22)', () => {
  it('기록이 하나도 없으면 안내와 기록하기 버튼을 보여 준다', async () => {
    vi.mocked(fetchMilestones).mockResolvedValue([])
    vi.mocked(fetchBodyMeasures).mockResolvedValue([])
    const { router } = renderApp('/timeline', auth)
    expect(await screen.findByText('아직 기록이 없어요')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: '유형' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: '기록하기' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/milestones/new'))
  })

  it('불러오지 못하면 안내하고, 다시 시도할 수 있다', async () => {
    vi.mocked(fetchBodyMeasures).mockRejectedValueOnce(new Error('offline'))
    renderApp('/timeline', auth)
    const banner = await screen.findByRole('alert')
    await userEvent.click(within(banner).getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByText('72.1cm · 8.9kg')).toBeInTheDocument()
    expect(fetchBodyMeasures).toHaveBeenCalledTimes(2)
  })
})
