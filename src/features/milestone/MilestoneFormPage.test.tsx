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
  fetchMilestones,
  updateMilestone,
  type Milestone,
} from '@/lib/milestoneApi'

// 발달 기록 입력·수정 (T-20·T-21, SCR-05, FR-MS-01~07). 테스트 데이터는 가명이다.

vi.mock('@/lib/childApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/childApi')>()),
  fetchMyChild: vi.fn(),
}))
vi.mock('@/lib/milestoneApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/milestoneApi')>()),
  fetchMilestone: vi.fn(),
  fetchMilestones: vi.fn(),
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
  vi.mocked(fetchMilestones).mockResolvedValue([])
  vi.mocked(createMilestone).mockImplementation(async (input) => ({ id: 'new', ...input }))
  vi.mocked(updateMilestone).mockImplementation(async (id, input) => ({ id, ...input }))
  vi.mocked(deleteMilestone).mockResolvedValue()
})
afterEach(() => vi.useRealTimers())

/** 성장 > 기록 등에서 입력 화면으로 이동한 상태로 시작한다 (저장 후 돌아갈 곳 확인용) */
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
    await openFrom('/growth/timeline', '/milestones/new')
    for (const name of ['단어', '행동', '표정']) {
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

  it('행동·표정은 기본 예시를 누르면 내용 칸에 채운다. 놀이 예시 일부는 행동에 있다 (R42)', async () => {
    await openFrom('/growth/timeline', '/milestones/new')
    expect(screen.queryByRole('radio', { name: '놀이' })).not.toBeInTheDocument()
    await userEvent.click(typeRadio('행동'))
    const examples = screen.getByRole('group', { name: '예시에서 고르기' })
    expect(within(examples).getAllByRole('button')).toHaveLength(15)
    await userEvent.click(within(examples).getByRole('button', { name: '까꿍놀이' }))
    expect(titleInput()).toHaveValue('까꿍놀이')
  })

  it('날짜 아래에 생후 일수를 보여 주고, 날짜를 바꾸면 다시 계산한다 (FR-MS-03)', async () => {
    await openFrom('/growth/timeline', '/milestones/new')
    expect(screen.getByText('생후 9개월 14일')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('날짜'), { target: { value: '2026-01-08' } })
    expect(await screen.findByText('생후 0일')).toBeInTheDocument()
  })

  it('저장하면 알림을 띄우고 진입했던 화면으로 돌아간다 (FR-MS-07)', async () => {
    const { router } = await openFrom('/growth/timeline', '/milestones/new')
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
    await waitFor(() => expect(router.state.location.pathname).toBe('/growth/timeline'))
  })

  it('취소하면 저장하지 않고 진입했던 화면으로 돌아간다', async () => {
    const { router } = await openFrom('/', '/milestones/new?type=word')
    await userEvent.type(titleInput(), '맘마')
    await userEvent.click(screen.getByRole('button', { name: '취소' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(createMilestone).not.toHaveBeenCalled()
  })

  it.each(['word', 'behavior'])(
    '주소로 바로 들어왔으면(type=%s) 뒤로 가기는 성장 > 기록으로 간다',
    async (type) => {
      const { router } = renderApp(`/milestones/new?type=${type}`, auth)
      await userEvent.click(await screen.findByRole('button', { name: '뒤로' }))
      await waitFor(() => expect(router.state.location.pathname).toBe('/growth/timeline'))
    },
  )

  it('입력 화면에서는 모바일 하단 탭을 숨긴다', async () => {
    await openFrom('/growth/timeline', '/milestones/new')
    // PC 왼쪽 메뉴만 남는다 (jsdom에서는 화면 폭과 상관없이 둘 다 그려지므로 개수로 확인)
    expect(screen.getAllByRole('navigation', { name: '주 메뉴' })).toHaveLength(1)
  })
})

describe('수정·삭제 (FR-COM-30~31)', () => {
  it('저장한 값이 채워진 수정 화면이 열리고, 수정하면 같은 기록을 바꾼다', async () => {
    const { router } = await openFrom('/growth/timeline', '/milestones/m1')
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
    await waitFor(() => expect(router.state.location.pathname).toBe('/growth/timeline'))
  })

  it('삭제 확인 창을 거쳐 삭제하고 진입했던 화면으로 돌아간다', async () => {
    const { router } = await openFrom('/growth/timeline', '/milestones/m1')
    await userEvent.click(await screen.findByRole('button', { name: '삭제' }))
    const dialog = await screen.findByRole('alertdialog', { name: '이 기록을 삭제할까요?' })
    await userEvent.click(within(dialog).getByRole('button', { name: '삭제' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/growth/timeline'))
    expect(deleteMilestone).toHaveBeenCalledWith('m1')
  })

  it('없는 기록이면 안내한다', async () => {
    vi.mocked(fetchMilestone).mockResolvedValue(null)
    await openFrom('/growth/timeline', '/milestones/unknown')
    expect(await screen.findByText(/기록을 찾을 수 없어요/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument()
  })
})

describe('저장 실패', () => {
  it('네트워크 오류면 상단에 안내하고, 입력값을 유지한 채 다시 시도할 수 있다', async () => {
    vi.mocked(createMilestone).mockRejectedValueOnce(new MilestoneSaveError('network'))
    await openFrom('/growth/timeline', '/milestones/new?type=word')
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
    await openFrom('/growth/timeline', '/milestones/new?type=word')
    await userEvent.type(titleInput(), '맘마')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByText('오늘 이후 날짜는 고를 수 없어요')).toBeInTheDocument()
    expect(screen.getByLabelText('날짜')).toHaveAttribute('aria-invalid', 'true')
  })

  it('서버에서 같은 내용으로 거부되면 내용 칸에 안내한다 (다른 기기에서 먼저 저장한 경우)', async () => {
    vi.mocked(createMilestone).mockRejectedValueOnce(new MilestoneSaveError('duplicate'))
    await openFrom('/growth/timeline', '/milestones/new?type=word')
    await userEvent.type(titleInput(), '맘마')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByText('이미 말한 단어예요')).toBeInTheDocument()
    expect(titleInput()).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('비슷한 기록·중복 안내 (F-07, FR-MS-05~06)', () => {
  // 날짜 최신순
  const previous: Milestone[] = [
    { id: 'w2', type: 'word', date: '2026-10-03', title: '엄마', memo: null },
    saved,
    { id: 'e2', type: 'expression', date: '2026-09-20', title: '소리 내어 웃기', memo: null },
    { id: 'e1', type: 'expression', date: '2026-09-18', title: '엄마 보고 웃기', memo: null },
    { id: 'w1', type: 'word', date: '2026-09-14', title: '맘마', memo: null },
  ]

  beforeEach(() => {
    vi.mocked(fetchMilestones).mockResolvedValue(previous)
  })

  function similarTitles() {
    const list = screen.queryByRole('region', { name: '이전에 기록한 비슷한 내용' })
    return list
      ? within(list)
          .getAllByRole('listitem')
          .map((item) => item.textContent)
      : []
  }

  it('입력하는 동안 같은 유형에서 입력한 글자를 포함하는 기록을 보여 준다', async () => {
    await openFrom('/', '/milestones/new?type=word')
    await userEvent.type(titleInput(), '마')
    await waitFor(() =>
      expect(similarTitles()).toEqual(['엄마2026. 10. 3. (토)', '맘마2026. 9. 14. (월)']),
    )
    await userEvent.clear(titleInput())
    expect(similarTitles()).toEqual([])
  })

  it('유형을 바꾸면 그 유형의 기록에서 다시 찾는다', async () => {
    await openFrom('/', '/milestones/new?type=word')
    await userEvent.type(titleInput(), '엄마')
    await waitFor(() => expect(similarTitles()).toEqual(['엄마2026. 10. 3. (토)']))
    await userEvent.click(typeRadio('표정'))
    expect(similarTitles()).toEqual(['엄마 보고 웃기2026. 9. 18. (금)'])
  })

  /** 새 기록 화면에서 유형을 고르고 내용을 입력한 뒤 저장을 누른다 */
  async function submitNew(type: string, title: string) {
    const result = await openFrom('/', '/milestones/new')
    await userEvent.click(typeRadio(type))
    await userEvent.type(titleInput(), title)
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    return result
  }

  it('같은 단어를 저장하면 안내만 하고 저장하지 않는다', async () => {
    const { router } = await submitNew('단어', ' 맘마 ')

    const dialog = await screen.findByRole('alertdialog', { name: '이미 말한 단어예요' })
    expect(dialog).toHaveTextContent('"맘마" · 2026. 9. 14. (월)에 기록했어요')
    expect(
      within(dialog)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['확인'])
    await userEvent.click(within(dialog).getByRole('button', { name: '확인' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(createMilestone).not.toHaveBeenCalled()
    expect(router.state.location.pathname).toBe('/milestones/new')
    expect(titleInput()).toHaveValue(' 맘마 ')

    // 다시 저장해도 같은 안내
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByRole('alertdialog', { name: '이미 말한 단어예요' })).toBeVisible()
    expect(createMilestone).not.toHaveBeenCalled()
  })

  it('행동·표정도 같은 내용이면 안내만 하고 저장하지 않는다', async () => {
    const { router } = await submitNew('표정', ' 엄마 보고 웃기 ')

    const dialog = await screen.findByRole('alertdialog', { name: '이미 기록된 내용입니다' })
    expect(dialog).toHaveTextContent('"엄마 보고 웃기" · 2026. 9. 18. (금)에 기록했어요')
    expect(within(dialog).queryByRole('button', { name: '그래도 저장' })).not.toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: '확인' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(createMilestone).not.toHaveBeenCalled()
    expect(router.state.location.pathname).toBe('/milestones/new')
    expect(titleInput()).toHaveValue(' 엄마 보고 웃기 ')
  })

  it('비슷하기만 하거나 유형이 다르면 안내 없이 저장한다', async () => {
    await openFrom('/growth/timeline', '/milestones/new')
    await userEvent.click(typeRadio('행동'))
    await userEvent.type(titleInput(), '엄마 보고 웃기')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByText('저장했어요')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('수정할 때는 자신을 빼고 찾고, 유형·내용을 바꾸지 않았으면 안내 없이 저장한다', async () => {
    await openFrom('/growth/timeline', '/milestones/m1')
    await screen.findByRole('heading', { name: '발달 기록 수정' })
    // 같은 내용(e2)이 이미 있지만, 원래 내용 그대로 메모만 고쳤다
    await waitFor(() => expect(similarTitles()).toEqual(['소리 내어 웃기2026. 9. 20. (일)']))
    await userEvent.type(screen.getByLabelText('메모'), '!')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByText('저장했어요')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(updateMilestone).toHaveBeenCalledWith(
      'm1',
      expect.objectContaining({ memo: '목욕할 때!' }),
    )
  })

  it('수정하면서 다른 기록과 같은 내용으로 바꾸면 저장하지 않는다', async () => {
    await openFrom('/growth/timeline', '/milestones/m1')
    await screen.findByRole('heading', { name: '발달 기록 수정' })
    await userEvent.clear(titleInput())
    await userEvent.type(titleInput(), '엄마 보고 웃기')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    const dialog = await screen.findByRole('alertdialog', { name: '이미 기록된 내용입니다' })
    expect(dialog).toHaveTextContent('2026. 9. 18. (금)')
    expect(updateMilestone).not.toHaveBeenCalled()
  })

  it('수정하면서 유형을 단어로 바꿔 이미 있는 단어와 같아지면 저장하지 않는다', async () => {
    await openFrom('/growth/timeline', '/milestones/m1')
    await screen.findByRole('heading', { name: '발달 기록 수정' })
    await userEvent.click(typeRadio('단어'))
    await userEvent.clear(titleInput())
    await userEvent.type(titleInput(), '엄마')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    const dialog = await screen.findByRole('alertdialog', { name: '이미 말한 단어예요' })
    expect(dialog).toHaveTextContent('"엄마" · 2026. 10. 3. (토)에 기록했어요')
    expect(updateMilestone).not.toHaveBeenCalled()
  })

  it('기록 목록을 불러오지 못하면 저장하지 않고 상단에 안내한다', async () => {
    vi.mocked(fetchMilestones).mockRejectedValue(new Error('offline'))
    await openFrom('/', '/milestones/new?type=word')
    await userEvent.type(titleInput(), '맘마')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('저장하지 못했어요')
    expect(createMilestone).not.toHaveBeenCalled()
  })
})
