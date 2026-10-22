import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

/**
 * 로그인 상태와 로그아웃. 여러 화면(설정, 아이 정보 등록 등)이 함께 쓴다.
 * 로그인 화면 전용 API(코드 받기·확인)는 features/auth/authApi.ts에 있다.
 */

export type AuthState =
  | { status: 'loading'; session: null }
  | { status: 'signedOut'; session: null }
  | { status: 'signedIn'; session: Session }

/** 로그인 상태. 실제 값은 AuthProvider가 넣고, 테스트에서는 원하는 값을 직접 넣는다 */
export const AuthContext = createContext<AuthState>({ status: 'loading', session: null })

export function useAuth(): AuthState {
  return useContext(AuthContext)
}

/**
 * 이 기기에서 로그아웃한다 (FR-SET-08). 다른 기기의 로그인은 유지한다.
 * 성공하면 AuthProvider가 로그아웃 상태로 바뀌고 데이터 캐시를 비운다.
 */
export async function signOut(): Promise<{ ok: boolean }> {
  try {
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    return { ok: !error }
  } catch {
    return { ok: false }
  }
}
