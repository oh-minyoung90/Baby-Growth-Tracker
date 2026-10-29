import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { addDays } from 'date-fns'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { todayString } from '@/domain/date'
import type { AuthState } from '@/lib/auth'
import { renderApp } from '@/test/renderApp'
import { ChildSaveError, fetchMyChild, saveChild, type Child } from '@/lib/childApi'

// 아이 정보 등록·수정 (T-13, FR-CHILD-01~03). 테스트 데이터는 가명이다.
vi.mock('@/lib/childApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/childApi')>()),
  fetchMyChild: vi.fn(),
  saveChild: vi.fn(),
}))
const mockedFetchChild = vi.mocked(fetchMyChild)
const mockedSaveChild = vi.mocked(saveChild)

const auth: AuthState = { status: 'signedIn', session: { user: { id: 'u1' } } as Session }
const saved: Child = { id: 'c1', nickname: '하늘이', birthDate: '2026-01-08' }

beforeEach(() => {
  mockedFetchChild.mockReset()
  mockedSaveChild.mockReset()
  mockedSaveChild.mockImplementation(async (_ownerId, input) => ({ id: 'c1', ...input }))
})

function nameInput() {
  return screen.getByLabelText('이름 또는 별명')
}

function birthInput() {
  return screen.getByLabelText('생년월일')
}

/** 날짜 입력칸은 브라우저마다 입력 방식이 달라 값을 바로 넣는다 */
function setBirth(value: string) {
  fireEvent.change(birthInput(), { target: { value } })
}

describe('첫 등록 (SCR-02)', () => {
  async function renderSetup() {
    mockedFetchChild.mockResolvedValue(null)
    const result = renderApp('/setup', auth)
    await screen.findByRole('heading', { name: /아이 정보를/ })
    return result
  }

  it('비워 두고 시작하면 두 칸 모두 안내한다', async () => {
    await renderSetup()
    await userEvent.click(screen.getByRole('button', { name: '시작하기' }))
    expect(await screen.findByText('이름 또는 별명을 입력해 주세요')).toBeInTheDocument()
    expect(
      screen.getByText('날짜를 선택해 주세요', { selector: '[role=alert]' }),
    ).toBeInTheDocument()
    expect(mockedSaveChild).not.toHaveBeenCalled()
  })

  it('공백만 입력한 이름은 받지 않는다', async () => {
    await renderSetup()
    await userEvent.type(nameInput(), '   ')
    setBirth('2026-01-08')
    await userEvent.click(screen.getByRole('button', { name: '시작하기' }))
    expect(await screen.findByText('이름 또는 별명을 입력해 주세요')).toBeInTheDocument()
    expect(mockedSaveChild).not.toHaveBeenCalled()
  })

  it('이름은 20자까지만 입력되고 글자 수를 보여 준다', async () => {
    await renderSetup()
    await userEvent.type(nameInput(), '가'.repeat(25))
    expect(nameInput()).toHaveValue('가'.repeat(20))
    expect(screen.getByText('20 / 20')).toBeInTheDocument()
  })

  it('오늘 이후 날짜는 고를 수 없다', async () => {
    await renderSetup()
    expect(birthInput()).toHaveAttribute('max', todayString())
    await userEvent.type(nameInput(), '하늘이')
    setBirth(todayString(addDays(new Date(), 1)))
    await userEvent.click(screen.getByRole('button', { name: '시작하기' }))
    expect(await screen.findByText('오늘 이후 날짜는 고를 수 없어요')).toBeInTheDocument()
    expect(mockedSaveChild).not.toHaveBeenCalled()
  })

  it('입력하는 대로 오늘 생후 일수를 미리 보여 준다', async () => {
    await renderSetup()
    setBirth(todayString())
    expect(screen.getByText('우리 아이는 오늘 생후 0일이에요')).toBeInTheDocument()
    await userEvent.type(nameInput(), '하늘이')
    expect(screen.getByText('하늘이는 오늘 생후 0일이에요')).toBeInTheDocument()
  })

  it('저장하면 앞뒤 공백을 지운 이름으로 저장하고 홈으로 간다', async () => {
    const { router } = await renderSetup()
    await userEvent.type(nameInput(), '  하늘이 ')
    setBirth('2026-01-08')
    await userEvent.click(screen.getByRole('button', { name: '시작하기' }))
    expect(await screen.findByRole('heading', { level: 1, name: /^하늘이/ })).toBeInTheDocument()
    expect(mockedSaveChild).toHaveBeenCalledWith('u1', {
      nickname: '하늘이',
      birthDate: '2026-01-08',
    })
    expect(router.state.location.pathname).toBe('/')
  })

  it.each([
    ['network', '저장하지 못했어요. 인터넷 연결을 확인해 주세요'],
    ['futureDate', '오늘 이후 날짜는 고를 수 없어요'],
    ['invalid', '이름은 1~20자로 입력해 주세요'],
  ] as const)('저장에 실패하면(%s) 안내하고 입력값을 그대로 둔다', async (reason, message) => {
    mockedSaveChild.mockRejectedValue(new ChildSaveError(reason))
    const { router } = await renderSetup()
    await userEvent.type(nameInput(), '하늘이')
    setBirth('2026-01-08')
    await userEvent.click(screen.getByRole('button', { name: '시작하기' }))
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(nameInput()).toHaveValue('하늘이')
    expect(router.state.location.pathname).toBe('/setup')
  })
})

describe('네트워크 오류 (기능요구사항서 3.4)', () => {
  it('상단에 안내하고, 입력값을 유지한 채 다시 시도할 수 있다', async () => {
    mockedFetchChild.mockResolvedValue(null)
    mockedSaveChild.mockRejectedValueOnce(new ChildSaveError('network'))
    const { router } = renderApp('/setup', auth)
    await screen.findByRole('heading', { name: /아이 정보를/ })
    await userEvent.type(nameInput(), '하늘이')
    setBirth('2026-01-08')
    await userEvent.click(screen.getByRole('button', { name: '시작하기' }))

    const banner = await screen.findByRole('alert')
    expect(banner).toHaveTextContent('저장하지 못했어요. 인터넷 연결을 확인해 주세요')
    expect(nameInput()).toHaveValue('하늘이')

    await userEvent.click(within(banner).getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByRole('heading', { level: 1, name: /^하늘이/ })).toBeInTheDocument()
    expect(mockedSaveChild).toHaveBeenCalledTimes(2)
    expect(router.state.location.pathname).toBe('/')
  })
})

describe('설정에서 수정 (FR-CHILD-03)', () => {
  async function renderEdit() {
    mockedFetchChild.mockResolvedValue(saved)
    const result = renderApp('/settings/child', auth)
    await screen.findByRole('heading', { level: 1, name: '아이 정보' })
    return result
  }

  it('설정 화면의 아이 정보 카드에서 수정 화면으로 간다', async () => {
    mockedFetchChild.mockResolvedValue(saved)
    const { router } = renderApp('/settings', auth)
    await userEvent.click(await screen.findByRole('link', { name: '아이 정보 수정: 하늘이' }))
    expect(router.state.location.pathname).toBe('/settings/child')
    expect(await screen.findByLabelText('이름 또는 별명')).toHaveValue('하늘이')
  })

  it('저장한 값이 채워져 있다', async () => {
    await renderEdit()
    expect(nameInput()).toHaveValue('하늘이')
    expect(birthInput()).toHaveValue('2026-01-08')
  })

  it('이름만 바꾸면 확인 없이 저장하고 설정으로 돌아간다', async () => {
    const { router } = await renderEdit()
    await userEvent.clear(nameInput())
    await userEvent.type(nameInput(), '바다')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByText('저장했어요')).toBeInTheDocument()
    expect(mockedSaveChild).toHaveBeenCalledWith('u1', {
      nickname: '바다',
      birthDate: '2026-01-08',
    })
    expect(router.state.location.pathname).toBe('/settings')
  })

  it('생년월일을 바꾸면 한 번 더 묻고, 취소하면 저장하지 않는다', async () => {
    const { router } = await renderEdit()
    setBirth('2026-01-09')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    const dialog = await screen.findByRole('alertdialog', { name: '생년월일을 바꿀까요?' })
    expect(dialog).toHaveTextContent('모든 기록의 생후 일수 표시가 바뀌어요')
    await userEvent.click(within(dialog).getByRole('button', { name: '취소' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(mockedSaveChild).not.toHaveBeenCalled()
    expect(router.state.location.pathname).toBe('/settings/child')
  })

  it('생년월일 변경을 확인하면 저장한다', async () => {
    const { router } = await renderEdit()
    setBirth('2026-01-09')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: '바꾸기' }))
    expect(await screen.findByText('저장했어요')).toBeInTheDocument()
    expect(mockedSaveChild).toHaveBeenCalledWith('u1', {
      nickname: '하늘이',
      birthDate: '2026-01-09',
    })
    expect(router.state.location.pathname).toBe('/settings')
  })
})
