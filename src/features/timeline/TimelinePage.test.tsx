import { fetchFoods } from '@/lib/foodApi'
import type { Food } from '@/lib/foodApi'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthState } from '@/lib/auth'
import { fetchBodyMeasures, type BodyMeasure } from '@/lib/bodyApi'
import { fetchMyChild } from '@/lib/childApi'
import { fetchMilestone, fetchMilestones, type Milestone } from '@/lib/milestoneApi'
import { renderApp } from '@/test/renderApp'

// 성장 > 기록: 타임라인 (T-23, T-52, SCR-07, FR-TL-01~05, 07~10). 테스트 데이터는 가명이다.

vi.mock('@/lib/foodApi', async (original) => ({
  ...(await original<typeof import('@/lib/foodApi')>()),
  fetchFoods: vi.fn(),
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
  vi.mocked(fetchFoods).mockResolvedValue([])
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

async function renderTimeline(path = '/growth/timeline') {
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
    const { router } = await renderTimeline('/growth/timeline?types=word,expression')
    await userEvent.click(screen.getByRole('link', { name: /소리 내어 웃기/ }))
    expect(await screen.findByRole('heading', { name: '발달 기록 수정' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/milestones/e1')

    await userEvent.click(await screen.findByRole('button', { name: '취소' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/growth/timeline'))
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
    for (const name of ['단어', '행동', '표정', '키·몸무게']) {
      expect(typeChip(name)).toHaveAttribute('aria-pressed', 'true')
    }
    expect(periodChip('전체')).toBeChecked()

    await userEvent.click(typeChip('단어'))
    expect(typeChip('단어')).toHaveAttribute('aria-pressed', 'false')
    expect(titles()).toEqual(['소리 내어 웃기', '72.1cm · 8.9kg', '잡고 서기'])
    expect(router.state.location.search).toBe('?types=behavior%2Cexpression%2Cmeasure%2Cfood')

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
    await renderTimeline('/growth/timeline?period=custom&from=2026-10-10&to=2026-10-01')
    expect(screen.getByText('종료일은 시작일 이후로 골라 주세요')).toBeInTheDocument()
    expect(screen.getByLabelText('종료일')).toHaveAttribute('aria-invalid', 'true')
  })

  it('결과가 없으면 안내하고, 필터 초기화로 전체를 다시 보여 준다', async () => {
    const { router } = await renderTimeline(
      '/growth/timeline?types=word&period=custom&from=2026-08-01&to=2026-08-31',
    )
    expect(screen.getByText('조건에 맞는 기록이 없어요')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '필터 초기화' }))
    expect(titles()).toHaveLength(5)
    expect(router.state.location.search).toBe('')
    expect(typeChip('행동')).toHaveAttribute('aria-pressed', 'true')
    expect(periodChip('전체')).toBeChecked()
  })
})

describe('유형별 개수와 추가 버튼 (FR-TL-08~10)', () => {
  function countCard(name: string) {
    return within(screen.getByRole('group', { name: '유형별 개수' })).getByRole('button', { name })
  }

  it('단어·행동·표정 개수를 보여 주고, 누르면 그 유형만 본다', async () => {
    const { router } = await renderTimeline()
    expect(countCard('단어 2개')).toHaveAttribute('aria-pressed', 'false')
    expect(countCard('행동 1개')).toBeInTheDocument()
    expect(countCard('표정 1개')).toBeInTheDocument()

    await userEvent.click(countCard('단어 2개'))
    expect(titles()).toEqual(['네', '엄마'])
    expect(router.state.location.search).toBe('?types=word')
    expect(countCard('단어 2개')).toHaveAttribute('aria-pressed', 'true')
    expect(typeChip('행동')).toHaveAttribute('aria-pressed', 'false')

    // 다시 누르면 필터 초기화
    await userEvent.click(countCard('단어 2개'))
    expect(titles()).toHaveLength(5)
    expect(router.state.location.search).toBe('')
  })

  it('개수는 필터와 관계없이 전체 기준이고, 누르면 기간도 전체로 바꾼다', async () => {
    await renderTimeline('/growth/timeline?period=this')
    expect(titles()).toEqual(['네', '소리 내어 웃기'])
    expect(countCard('행동 1개')).toBeInTheDocument()
    await userEvent.click(countCard('행동 1개'))
    expect(titles()).toEqual(['잡고 서기'])
    expect(periodChip('전체')).toBeChecked()
  })

  it('한 유형만 보고 있으면 추가 버튼이 그 유형을 고른 채 입력 화면을 연다', async () => {
    const { router } = await renderTimeline('/growth/timeline?types=expression,measure')
    await userEvent.click(screen.getByRole('button', { name: '발달 기록 추가' }))
    expect(await screen.findByRole('heading', { name: '발달 기록' })).toBeInTheDocument()
    expect(router.state.location.pathname + router.state.location.search).toBe(
      '/milestones/new?type=expression',
    )
    expect(screen.getByRole('radio', { name: '표정' })).toBeChecked()
  })

  it('여러 유형을 보고 있으면 유형을 고르지 않은 채 연다', async () => {
    const { router } = await renderTimeline()
    await userEvent.click(screen.getByRole('button', { name: '발달 기록 추가' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/milestones/new'))
    expect(router.state.location.search).toBe('')
  })
})

describe('0건·불러오기 실패 (FR-COM-20~22)', () => {
  it('기록이 하나도 없으면 안내와 기록하기 버튼을 보여 준다', async () => {
    vi.mocked(fetchMilestones).mockResolvedValue([])
    vi.mocked(fetchBodyMeasures).mockResolvedValue([])
    const { router } = renderApp('/growth/timeline', auth)
    expect(await screen.findByText('아직 기록이 없어요')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: '유형' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: '기록하기' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/milestones/new'))
  })

  it('불러오지 못하면 안내하고, 다시 시도할 수 있다', async () => {
    vi.mocked(fetchBodyMeasures).mockRejectedValueOnce(new Error('offline'))
    renderApp('/growth/timeline', auth)
    const banner = await screen.findByRole('alert')
    await userEvent.click(within(banner).getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByText('72.1cm · 8.9kg')).toBeInTheDocument()
    expect(fetchBodyMeasures).toHaveBeenCalledTimes(2)
  })
})

describe('처음 먹은 음식 (T-51)', () => {
  it('음식 유형만 고를 수 있고 항목은 음식 상세로 연결한다', async () => {
    vi.mocked(fetchFoods).mockResolvedValue([
      { id: 'f1', name: '브로콜리', firstTriedDate: '2026-10-05' },
      { id: 'f2', name: '처음 날짜 모름', firstTriedDate: null },
    ] as Food[])
    const { router } = await renderTimeline('/growth/timeline?types=food')
    expect(titles()).toEqual(['브로콜리'])
    expect(screen.getByRole('link', { name: /브로콜리/ })).toHaveAttribute(
      'href',
      '/meals/foods/f1',
    )
    expect(typeChip('처음 먹은 음식')).toHaveAttribute('aria-pressed', 'true')
    expect(router.state.location.search).toBe('?types=food')
  })
  it('첫 날짜 변경·체크 해제 결과를 다시 읽어 이동·제거하며 항목을 중복 저장하지 않는다', async () => {
    let foods = [{ id: 'f1', name: '쌀', firstTriedDate: '2026-10-05' }] as Food[]
    vi.mocked(fetchFoods).mockImplementation(async () => [...foods])
    const { queryClient } = await renderTimeline('/growth/timeline?types=food')
    expect(titles()).toEqual(['쌀'])
    foods = [{ ...foods[0], firstTriedDate: '2026-09-08' }]
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['foods'] })
    })
    expect(titles()).toEqual(['쌀'])
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /쌀/ })).toHaveTextContent('2026. 9. 8.'),
    )
    foods = []
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['foods'] })
    })
    await waitFor(() => expect(titles()).toEqual([]))
    expect(screen.getByText('조건에 맞는 기록이 없어요')).toBeInTheDocument()
  })
  it('음식 조회가 실패하면 빈 기록으로 오해시키지 않고 다시 시도한다', async () => {
    vi.mocked(fetchFoods).mockRejectedValueOnce(new Error('offline'))
    renderApp('/growth/timeline', auth)
    const alert = await screen.findByRole('alert')
    await userEvent.click(within(alert).getByRole('button', { name: '다시 시도' }))
    await screen.findByRole('group', { name: '유형' })
    expect(fetchFoods).toHaveBeenCalledTimes(2)
    expect(fetchMilestones).toHaveBeenCalledTimes(1)
  })
})
