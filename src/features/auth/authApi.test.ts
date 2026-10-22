import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '@/lib/supabase'
import { sendLoginCode, verifyLoginCode } from './authApi'

// Supabase 응답 → 화면 결과 변환 (FR-AUTH-02, 04)
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { signInWithOtp: vi.fn(), verifyOtp: vi.fn() } },
}))
const signIn = vi.mocked(supabase.auth.signInWithOtp)
const verifyOtp = vi.mocked(supabase.auth.verifyOtp)

const ok = { data: { user: null, session: null }, error: null }
const fail = (error: Error) => ({ data: { user: null, session: null }, error }) as never

beforeEach(() => {
  signIn.mockReset()
  verifyOtp.mockReset()
})

describe('sendLoginCode', () => {
  it('회원가입 없이 코드만 요청한다', async () => {
    signIn.mockResolvedValue(ok as never)
    await sendLoginCode('parent@example.com')
    expect(signIn).toHaveBeenCalledWith({
      email: 'parent@example.com',
      options: { shouldCreateUser: false },
    })
  })

  it('등록되지 않은 이메일(422 otp_disabled)도 성공처럼 처리한다', async () => {
    // 실제 dev 프로젝트 응답: status 422, code otp_disabled, "Signups not allowed for otp"
    signIn.mockResolvedValue(
      fail(new AuthApiError('Signups not allowed for otp', 422, 'otp_disabled')),
    )
    expect(await sendLoginCode('stranger@example.com')).toEqual({ ok: true })
  })

  it('요청이 너무 많으면(429) rateLimited', async () => {
    signIn.mockResolvedValue(
      fail(new AuthApiError('rate limit', 429, 'over_email_send_rate_limit')),
    )
    expect(await sendLoginCode('parent@example.com')).toEqual({ ok: false, reason: 'rateLimited' })
  })

  it('네트워크 오류면 network', async () => {
    signIn.mockResolvedValue(fail(new AuthRetryableFetchError('Failed to fetch', 0)))
    expect(await sendLoginCode('parent@example.com')).toEqual({ ok: false, reason: 'network' })
  })
})

describe('verifyLoginCode', () => {
  it('6자리 코드를 이메일 방식으로 확인한다', async () => {
    verifyOtp.mockResolvedValue(ok as never)
    expect(await verifyLoginCode('parent@example.com', '123456')).toEqual({ ok: true })
    expect(verifyOtp).toHaveBeenCalledWith({
      email: 'parent@example.com',
      token: '123456',
      type: 'email',
    })
  })

  it('틀리거나 만료된 코드면 invalid', async () => {
    verifyOtp.mockResolvedValue(
      fail(new AuthApiError('Token has expired or is invalid', 403, 'otp_expired')),
    )
    expect(await verifyLoginCode('parent@example.com', '000000')).toEqual({
      ok: false,
      reason: 'invalid',
    })
  })
})
