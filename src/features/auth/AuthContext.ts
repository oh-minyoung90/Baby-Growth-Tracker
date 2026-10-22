import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export type AuthState =
  | { status: 'loading'; session: null }
  | { status: 'signedOut'; session: null }
  | { status: 'signedIn'; session: Session }

/** 로그인 상태. 실제 값은 AuthProvider가 넣고, 테스트에서는 원하는 값을 직접 넣는다 */
export const AuthContext = createContext<AuthState>({ status: 'loading', session: null })

export function useAuth(): AuthState {
  return useContext(AuthContext)
}
