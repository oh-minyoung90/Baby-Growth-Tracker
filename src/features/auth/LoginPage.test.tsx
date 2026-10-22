import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendLoginCode, verifyLoginCode } from './authApi'
import { LoginPage } from './LoginPage'

// 로그인 화면 (SCR-01, FR-AUTH-01~04). 실제 Supabase 대신 authApi를 가짜로 바꿔 끼운다.
vi.mock('./authApi', () => ({
  sendLoginCode: vi.fn(),
  verifyLoginCode: vi.fn(),
}))
const send = vi.mocked(sendLoginCode)
const verify = vi.mocked(verifyLoginCode)

function setup() {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(<LoginPage />)
  return user
}

async function goToCodeStep(user: ReturnType<typeof userEvent.setup>) {
  send.mockResolvedValue({ ok: true })
  await user.type(screen.getByLabelText('이메일'), '  parent@example.com ')
  await user.click(screen.getByRole('button', { name: '인증 코드 받기' }))
  await screen.findByLabelText('인증 코드 6자리')
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  send.mockReset()
  verify.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('이메일 단계', () => {
  it('이메일을 비우면 안내하고 코드를 보내지 않는다', async () => {
    const user = setup()
    await user.click(screen.getByRole('button', { name: '인증 코드 받기' }))
    expect(await screen.findByText('이메일을 입력해 주세요')).toBeInTheDocument()
    expect(send).not.toHaveBeenCalled()
  })

  it('이메일 형식이 틀리면 안내한다', async () => {
    const user = setup()
    await user.type(screen.getByLabelText('이메일'), 'parent@')
    await user.click(screen.getByRole('button', { name: '인증 코드 받기' }))
    expect(await screen.findByText('이메일 형식이 맞지 않아요')).toBeInTheDocument()
    expect(send).not.toHaveBeenCalled()
  })

  it('앞뒤 공백을 지우고 코드를 요청한 뒤 코드 입력 단계로 넘어간다', async () => {
    const user = setup()
    await goToCodeStep(user)
    expect(send).toHaveBeenCalledWith('parent@example.com')
    expect(screen.getByRole('status')).toHaveTextContent('입력한 이메일로 인증 코드를 보냈어요')
    expect(screen.getByText('10:00')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /코드 다시 받기 \(60초\)/ })).toBeDisabled()
  })

  it('요청이 너무 많으면 안내하고 이메일 단계에 머문다', async () => {
    send.mockResolvedValue({ ok: false, reason: 'rateLimited' })
    const user = setup()
    await user.type(screen.getByLabelText('이메일'), 'parent@example.com')
    await user.click(screen.getByRole('button', { name: '인증 코드 받기' }))
    expect(await screen.findByText('요청이 많아요. 잠시 후 다시 시도해 주세요')).toBeInTheDocument()
    expect(screen.queryByLabelText('인증 코드 6자리')).not.toBeInTheDocument()
  })
})

describe('코드 단계', () => {
  it('숫자만 6자리까지 입력된다', async () => {
    const user = setup()
    await goToCodeStep(user)
    const input = screen.getByLabelText('인증 코드 6자리')
    await user.type(input, '12ab34-5678')
    expect(input).toHaveValue('123456')
  })

  it('6자리가 아니면 안내하고 확인하지 않는다', async () => {
    const user = setup()
    await goToCodeStep(user)
    await user.type(screen.getByLabelText('인증 코드 6자리'), '1234')
    await user.click(screen.getByRole('button', { name: '로그인' }))
    expect(await screen.findByText('6자리 숫자를 입력해 주세요')).toBeInTheDocument()
    expect(verify).not.toHaveBeenCalled()
  })

  it('코드가 틀리면 안내한다 (FR-AUTH-04)', async () => {
    verify.mockResolvedValue({ ok: false, reason: 'invalid' })
    const user = setup()
    await goToCodeStep(user)
    await user.type(screen.getByLabelText('인증 코드 6자리'), '123456')
    await user.click(screen.getByRole('button', { name: '로그인' }))
    expect(await screen.findByText('코드가 맞지 않거나 만료되었어요')).toBeInTheDocument()
    expect(verify).toHaveBeenCalledWith('parent@example.com', '123456')
  })

  it('60초가 지나면 코드를 다시 받을 수 있고, 남은 시간이 다시 10분이 된다', async () => {
    const user = setup()
    await goToCodeStep(user)
    await act(() => vi.advanceTimersByTimeAsync(61_000))
    expect(screen.getByText('08:59')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '코드 다시 받기' }))
    expect(send).toHaveBeenCalledTimes(2)
    expect(
      await screen.findByText('새 인증 코드를 보냈어요. 이전 코드는 쓸 수 없어요'),
    ).toBeInTheDocument()
    expect(await screen.findByText('10:00')).toBeInTheDocument()
  })

  it('10분이 지나면 만료를 안내하고 로그인 버튼을 막는다', async () => {
    const user = setup()
    await goToCodeStep(user)
    await act(() => vi.advanceTimersByTimeAsync(600_000))
    expect(screen.getByText('코드가 만료되었어요. 코드를 다시 받아 주세요')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '로그인' })).toBeDisabled()
  })

  it('이메일을 다시 입력할 수 있다', async () => {
    const user = setup()
    await goToCodeStep(user)
    await user.click(screen.getByRole('button', { name: '이메일 다시 입력' }))
    expect(screen.getByLabelText('이메일')).toBeInTheDocument()
  })
})
