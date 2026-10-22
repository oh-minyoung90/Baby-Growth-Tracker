import { useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { AuthContext, type AuthState } from './AuthContext'

/** Supabase 로그인 상태를 앱 전체에 알려 준다 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<AuthState>({ status: 'loading', session: null })

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setState(
        data.session
          ? { status: 'signedIn', session: data.session }
          : { status: 'signedOut', session: null },
      )
    })

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // 로그아웃하면 이전 계정의 데이터가 화면에 남지 않도록 캐시를 비운다
      if (event === 'SIGNED_OUT') queryClient.clear()
      setState(session ? { status: 'signedIn', session } : { status: 'signedOut', session: null })
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [queryClient])

  return <AuthContext value={state}>{children}</AuthContext>
}
