import { isAuthApiError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

/**
 * 로그인 API (기능요구사항서 FR-AUTH-01~04, 기술요구사항서 7장).
 * 화면은 이 모듈만 쓰고 Supabase를 직접 부르지 않는다 (테스트에서 이 모듈만 바꿔 끼운다).
 */

export type SendCodeResult =
  { ok: true } | { ok: false; reason: 'rateLimited' | 'network' | 'unknown' }
export type VerifyCodeResult = { ok: true } | { ok: false; reason: 'invalid' | 'network' }

function isNetworkError(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof Error && error.name === 'AuthRetryableFetchError')
  )
}

/**
 * 이메일로 6자리 코드를 보낸다. 회원가입은 막혀 있어 등록된 계정에만 실제로 발송된다.
 * 등록되지 않은 이메일도 성공처럼 처리한다: 어떤 이메일이 허용된 계정인지 드러내지 않기 위함 (FR-AUTH-02)
 */
export async function sendLoginCode(email: string): Promise<SendCodeResult> {
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    })
    if (!error) return { ok: true }
    if (isNetworkError(error)) return { ok: false, reason: 'network' }
    if (isAuthApiError(error) && error.status === 429) return { ok: false, reason: 'rateLimited' }
    // 등록되지 않은 이메일(회원가입 차단)은 성공과 같은 화면을 보여 준다
    if (isAuthApiError(error) && (error.code === 'otp_disabled' || error.status === 422)) {
      return { ok: true }
    }
    return { ok: false, reason: 'unknown' }
  } catch (error) {
    return { ok: false, reason: isNetworkError(error) ? 'network' : 'unknown' }
  }
}

/** 6자리 코드를 확인한다. 성공하면 Supabase가 세션을 저장하고 AuthProvider가 로그인 상태로 바뀐다 */
export async function verifyLoginCode(email: string, code: string): Promise<VerifyCodeResult> {
  try {
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
    if (!error) return { ok: true }
    return { ok: false, reason: isNetworkError(error) ? 'network' : 'invalid' }
  } catch (error) {
    return { ok: false, reason: isNetworkError(error) ? 'network' : 'invalid' }
  }
}
