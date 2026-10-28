import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthState } from '@/lib/auth'
import { fetchMyChild } from '@/lib/childApi'
import { renderApp } from '@/test/renderApp'
import {
  BodySaveError,
  createBodyMeasure,
  deleteBodyMeasure,
  fetchBodyMeasures,
  updateBodyMeasure,
  type BodyMeasure,
} from '@/lib/bodyApi'

// 키·몸무게 입력·목록 (T-16, SCR-04, FR-BODY-01~02, 05~07). 테스트 데이터는 가명이다.
// 서버 대신 메모리 목록(store)에 저장해, 저장 후 목록을 다시 불러오는 흐름까지 확인한다.

vi.mock('@/lib/childApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/childApi')>()),
  fetchMyChild: vi.fn(),
}))
vi.mock('@/lib/bodyApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/bodyApi')>()),
  fetchBodyMeasures: vi.fn(),
  createBodyMeasure: vi.fn(),
  updateBodyMeasure: vi.fn(),
  deleteBodyMeasure: vi.fn(),
}))

const auth: AuthState = { status: 'signedIn', session: { user: { id: 'u1' } } as Session }
let store: BodyMeasure[] = []

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
  vi.mocked(fetchBodyMeasures).mockImplementation(async () =>
    [...store].sort((a, b) => b.date.localeCompare(a.date)),
  )
  vi.mocked(createBodyMeasure).mockImplementation(async (input) => {
    const created = { id: `m${store.length + 1}`, ...input }
    store.push(created)
    return created
  })
  vi.mocked(updateBodyMeasure).mockImplementation(async (id, input) => {
    const updated = { id, ...input }
    store = store.map((measure) => (measure.id === id ? updated : measure))
    return updated
  })
  vi.mocked(deleteBodyMeasure).mockImplementation(async (id) => {
    store = store.filter((measure) => measure.id !== id)
  })
})
afterEach(() => vi.useRealTimers())

function measure(values: Partial<BodyMeasure> & Pick<BodyMeasure, 'id' | 'date'>): BodyMeasure {
  return { heightCm: null, weightKg: null, memo: null, ...values }
}

async function renderBody(path = '/growth/body') {
  const result = renderApp(path, auth)
  // 시트가 열린 채로 시작하면 뒤 화면이 가려지므로(aria-hidden) 역할 대신 글자로 기다린다
  await screen.findByText('측정 기록', { selector: 'h2' })
  return result
}

async function openNewSheet() {
  await userEvent.click(screen.getByRole('button', { name: '측정 기록 추가' }))
  return screen.findByRole('dialog', { name: '키·몸무게 기록' })
}

function heightInput() {
  return screen.getByRole('textbox', { name: /^키/ })
}

function weightInput() {
  return screen.getByRole('textbox', { name: /^몸무게/ })
}

/** 시트는 뒤로 가기(주소 변경)로 닫히므로, 저장 알림보다 조금 늦게 사라질 수 있다 */
async function waitForSheetClosed() {
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
}

describe('측정 목록 (FR-BODY-05)', () => {
  it('기록이 없으면 안내하고, 기록하기를 누르면 입력 시트가 열린다', async () => {
    const { router } = await renderBody()
    expect(await screen.findByText('아직 측정 기록이 없어요')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '기록하기' }))
    expect(await screen.findByRole('dialog', { name: '키·몸무게 기록' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('?record=new')
  })

  it('측정 날짜 최신순으로, 생후 일수·메모와 함께 보여 주고 빈 값은 "-"로 표시한다', async () => {
    store = [
      measure({ id: 'a', date: '2026-09-30', heightCm: 72.1, weightKg: 8.9, memo: '영유아 검진' }),
      measure({ id: 'b', date: '2026-10-20', weightKg: 9.2 }),
      measure({ id: 'c', date: '2026-01-08', heightCm: 50, memo: '출생' }),
    ]
    await renderBody()
    const list = await screen.findByRole('list')
    const [first, second, third] = within(list).getAllByRole('listitem')

    expect(first).toHaveTextContent('2026. 10. 20. (화)')
    expect(first).toHaveTextContent('생후 9개월 12일')
    expect(within(first).getByText('-')).toBeInTheDocument()
    expect(first).toHaveTextContent('9.2kg')

    expect(second).toHaveTextContent('생후 8개월 22일 · 영유아 검진')
    expect(second).toHaveTextContent('72.1cm')
    expect(second).toHaveTextContent('8.9kg')

    expect(third).toHaveTextContent('생후 0일 · 출생')
    expect(third).toHaveTextContent('50.0cm')
  })

  it('불러오지 못하면 안내하고 다시 시도할 수 있다', async () => {
    vi.mocked(fetchBodyMeasures).mockRejectedValueOnce(new Error('network'))
    await renderBody()
    expect(await screen.findByRole('alert')).toHaveTextContent('정보를 불러오지 못했어요')
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByText('아직 측정 기록이 없어요')).toBeInTheDocument()
  })
})

describe('새 기록 (FR-BODY-01~02, 07)', () => {
  it('측정 날짜의 기본값은 오늘이다', async () => {
    await renderBody()
    const sheet = await openNewSheet()
    expect(within(sheet).getByLabelText('측정 날짜')).toHaveValue('2026-10-22')
    expect(within(sheet).getByLabelText('측정 날짜')).toHaveAttribute('min', '2026-01-08')
    expect(within(sheet).getByLabelText('측정 날짜')).toHaveAttribute('max', '2026-10-22')
  })

  it('키와 몸무게를 모두 비우면 저장하지 않고 안내한다', async () => {
    await renderBody()
    await openNewSheet()
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByText('키와 몸무게 중 하나 이상 입력해 주세요')).toBeInTheDocument()
    expect(heightInput()).toHaveAttribute('aria-invalid', 'true')
    expect(createBodyMeasure).not.toHaveBeenCalled()
  })

  it('범위를 벗어나면 저장하지 않고 안내한다', async () => {
    await renderBody()
    await openNewSheet()
    await userEvent.type(heightInput(), '200')
    await userEvent.type(weightInput(), '0.5')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByText('키는 30~150cm 사이로 입력해 주세요')).toBeInTheDocument()
    expect(screen.getByText('몸무게는 1~50kg 사이로 입력해 주세요')).toBeInTheDocument()
    expect(createBodyMeasure).not.toHaveBeenCalled()
  })

  it('숫자는 소수점 첫째 자리까지만 입력된다', async () => {
    await renderBody()
    await openNewSheet()
    await userEvent.type(heightInput(), '72.55')
    expect(heightInput()).toHaveValue('72.5')
    await userEvent.type(weightInput(), '9a')
    expect(weightInput()).toHaveValue('9')
  })

  it('저장하면 알림을 띄우고 시트를 닫은 뒤 목록에 바로 반영한다', async () => {
    const { router } = await renderBody()
    await openNewSheet()
    await userEvent.type(heightInput(), '72.5')
    await userEvent.type(weightInput(), '9.0')
    await userEvent.type(screen.getByLabelText('메모'), '  영유아 검진 ')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    expect(await screen.findByText('저장했어요')).toBeInTheDocument()
    expect(createBodyMeasure).toHaveBeenCalledWith({
      date: '2026-10-22',
      heightCm: 72.5,
      weightKg: 9,
      memo: '영유아 검진',
    })
    await waitForSheetClosed()
    expect(await screen.findByText('72.5cm')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/growth/body')
    expect(router.state.location.search).toBe('')
  })

  it('키만 입력해도 저장된다', async () => {
    await renderBody()
    await openNewSheet()
    await userEvent.type(heightInput(), '73')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByText('저장했어요')).toBeInTheDocument()
    expect(createBodyMeasure).toHaveBeenCalledWith(
      expect.objectContaining({ heightCm: 73, weightKg: null, memo: null }),
    )
  })

  it('취소하면 저장하지 않고 시트를 닫는다', async () => {
    const { router } = await renderBody()
    await openNewSheet()
    await userEvent.type(heightInput(), '73')
    await userEvent.click(screen.getByRole('button', { name: '취소' }))
    await waitForSheetClosed()
    expect(createBodyMeasure).not.toHaveBeenCalled()
    expect(router.state.location.search).toBe('')
  })
})

describe('같은 날짜 기록: 날짜마다 1건 (FR-BODY-06)', () => {
  beforeEach(() => {
    store = [
      measure({ id: 'a', date: '2026-10-22', heightCm: 72 }),
      measure({ id: 'b', date: '2026-09-30', heightCm: 71 }),
    ]
  })

  it('같은 날짜에 기록이 있으면 저장하지 않고 안내하며, 취소하면 입력 시트에 남는다', async () => {
    await renderBody()
    await openNewSheet()
    await userEvent.type(heightInput(), '73')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    const dialog = await screen.findByRole('alertdialog', {
      name: '같은 날짜에 측정 기록이 있어요',
    })
    expect(dialog).toHaveTextContent('측정 기록은 하루에 하나만 남길 수 있어요')
    await userEvent.click(within(dialog).getByRole('button', { name: '취소' }))
    expect(createBodyMeasure).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: '키·몸무게 기록' })).toBeInTheDocument()
    expect(heightInput()).toHaveValue('73')
  })

  it('기존 기록 수정을 누르면 그날 기록의 수정 시트로 바뀌고, 닫으면 목록으로 돌아간다', async () => {
    const { router } = await renderBody()
    await openNewSheet()
    await userEvent.type(heightInput(), '73')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: '기존 기록 수정' }))

    expect(await screen.findByRole('dialog', { name: '키·몸무게 수정' })).toBeInTheDocument()
    expect(heightInput()).toHaveValue('72.0')
    expect(router.state.location.search).toBe('?record=a')
    expect(createBodyMeasure).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: '취소' }))
    await waitForSheetClosed()
    expect(router.state.location.pathname).toBe('/growth/body')
    expect(router.state.location.search).toBe('')
  })

  it('수정할 때 다른 기록의 날짜로 바꾸면 같은 안내를 한다', async () => {
    await renderBody()
    await userEvent.click(await screen.findByRole('button', { name: /2026\. 9\. 30\./ }))
    await screen.findByRole('dialog', { name: '키·몸무게 수정' })
    fireEvent.change(screen.getByLabelText('측정 날짜'), { target: { value: '2026-10-22' } })
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(
      await screen.findByRole('alertdialog', { name: '같은 날짜에 측정 기록이 있어요' }),
    ).toBeInTheDocument()
    expect(updateBodyMeasure).not.toHaveBeenCalled()
  })

  it('날짜를 그대로 두고 수정하면 안내 없이 저장한다', async () => {
    await renderBody()
    await userEvent.click(await screen.findByRole('button', { name: /2026\. 10\. 22\./ }))
    await screen.findByRole('dialog', { name: '키·몸무게 수정' })
    await userEvent.type(weightInput(), '9')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByText('저장했어요')).toBeInTheDocument()
    expect(updateBodyMeasure).toHaveBeenCalledWith('a', expect.objectContaining({ weightKg: 9 }))
  })

  it('서버에서 같은 날짜로 거부되면 측정 날짜 칸에 안내한다 (FR-COM-13)', async () => {
    store = []
    vi.mocked(createBodyMeasure).mockRejectedValueOnce(new BodySaveError('duplicateDate'))
    await renderBody()
    await openNewSheet()
    await userEvent.type(heightInput(), '73')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByText('같은 날짜에 측정 기록이 있어요')).toBeInTheDocument()
    expect(screen.getByLabelText('측정 날짜')).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('수정·삭제 (FR-COM-30~31)', () => {
  beforeEach(() => {
    store = [
      measure({ id: 'a', date: '2026-09-30', heightCm: 72.1, weightKg: 8.9, memo: '영유아 검진' }),
    ]
  })

  async function openEditSheet() {
    await renderBody()
    await userEvent.click(await screen.findByRole('button', { name: /2026\. 9\. 30\./ }))
    return screen.findByRole('dialog', { name: '키·몸무게 수정' })
  }

  it('목록의 기록을 누르면 저장한 값이 채워진 수정 시트가 열린다', async () => {
    const sheet = await openEditSheet()
    expect(within(sheet).getByLabelText('측정 날짜')).toHaveValue('2026-09-30')
    expect(heightInput()).toHaveValue('72.1')
    expect(weightInput()).toHaveValue('8.9')
    expect(within(sheet).getByLabelText('메모')).toHaveValue('영유아 검진')
  })

  it('수정하면 같은 기록을 바꾸고, 날짜를 그대로 두면 같은 날짜 확인을 하지 않는다', async () => {
    await openEditSheet()
    await userEvent.clear(heightInput())
    await userEvent.type(heightInput(), '72.4')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByText('저장했어요')).toBeInTheDocument()
    expect(updateBodyMeasure).toHaveBeenCalledWith('a', {
      date: '2026-09-30',
      heightCm: 72.4,
      weightKg: 8.9,
      memo: '영유아 검진',
    })
    expect(await screen.findByText('72.4cm')).toBeInTheDocument()
  })

  it('삭제 확인 창을 거쳐 삭제하고 목록에서 뺀다', async () => {
    await openEditSheet()
    await userEvent.click(screen.getByRole('button', { name: '삭제' }))
    const dialog = await screen.findByRole('alertdialog', { name: '이 기록을 삭제할까요?' })
    await userEvent.click(within(dialog).getByRole('button', { name: '삭제' }))
    expect(await screen.findByText('아직 측정 기록이 없어요')).toBeInTheDocument()
    expect(deleteBodyMeasure).toHaveBeenCalledWith('a')
    await waitForSheetClosed()
  })

  it('삭제하지 못하면 안내하고 다시 시도할 수 있다', async () => {
    vi.mocked(deleteBodyMeasure).mockRejectedValueOnce(new Error('network'))
    await openEditSheet()
    await userEvent.click(screen.getByRole('button', { name: '삭제' }))
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: '삭제' }))
    const banner = await screen.findByRole('alert')
    expect(banner).toHaveTextContent('삭제하지 못했어요. 인터넷 연결을 확인해 주세요')
    await userEvent.click(within(banner).getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByText('아직 측정 기록이 없어요')).toBeInTheDocument()
  })
})

describe('저장 실패', () => {
  it('네트워크 오류면 상단에 안내하고, 입력값을 유지한 채 다시 시도할 수 있다', async () => {
    vi.mocked(createBodyMeasure).mockRejectedValueOnce(new BodySaveError('network'))
    await renderBody()
    await openNewSheet()
    await userEvent.type(heightInput(), '73')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    const banner = await screen.findByRole('alert')
    expect(banner).toHaveTextContent('저장하지 못했어요. 인터넷 연결을 확인해 주세요')
    expect(heightInput()).toHaveValue('73')

    await userEvent.click(within(banner).getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByText('저장했어요')).toBeInTheDocument()
    expect(createBodyMeasure).toHaveBeenCalledTimes(2)
  })

  it('서버 검증에 걸리면 화면 검증과 같은 칸에 같은 문구로 안내한다 (FR-COM-13)', async () => {
    vi.mocked(createBodyMeasure).mockRejectedValueOnce(new BodySaveError('beforeBirth'))
    await renderBody()
    await openNewSheet()
    await userEvent.type(heightInput(), '73')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByText('생년월일 이전 날짜는 고를 수 없어요')).toBeInTheDocument()
    expect(screen.getByLabelText('측정 날짜')).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('주소로 시트 열기 (홈 빠른 기록·타임라인에서 연결)', () => {
  it('?record=new로 들어오면 입력 시트가 열려 있고, 닫으면 검색 조건을 지운다', async () => {
    const { router } = await renderBody('/growth/body?record=new')
    expect(await screen.findByRole('dialog', { name: '키·몸무게 기록' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '취소' }))
    await waitForSheetClosed()
    expect(router.state.location.pathname).toBe('/growth/body')
    expect(router.state.location.search).toBe('')
  })

  it('?record=<id>로 들어오면 그 기록의 수정 시트가 열린다', async () => {
    store = [measure({ id: 'a', date: '2026-09-30', heightCm: 72.1, weightKg: 9 })]
    await renderBody('/growth/body?record=a')
    expect(await screen.findByRole('dialog', { name: '키·몸무게 수정' })).toBeInTheDocument()
    expect(heightInput()).toHaveValue('72.1')
    // 목록과 같이 소수점 첫째 자리까지 보여 준다
    expect(weightInput()).toHaveValue('9.0')
  })

  it('없는 기록이면 시트를 열지 않는다', async () => {
    await renderBody('/growth/body?record=unknown')
    expect(await screen.findByText('아직 측정 기록이 없어요')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
