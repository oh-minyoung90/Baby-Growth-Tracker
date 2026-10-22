import { act, render, screen } from '@testing-library/react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { AuthProvider } from './AuthProvider'

// 로그인 유지(FR-AUTH-05)와 로그아웃 시 캐시 비우기 (T-11)
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn() } },
}))
const getSession = vi.mocked(supabase.auth.getSession)
const onAuthStateChange = vi.mocked(supabase.auth.onAuthStateChange)

const session = { user: { id: 'u1' } } as Session
let emit: (event: AuthChangeEvent, session: Session | null) => void

function Status() {
  return <p>{useAuth().status}</p>
}

function renderProvider(queryClient = new QueryClient()) {
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Status />
      </AuthProvider>
    </QueryClientProvider>,
  )
  return queryClient
}

beforeEach(() => {
  getSession.mockReset()
  onAuthStateChange.mockReset()
  onAuthStateChange.mockImplementation((callback) => {
    emit = (event, s) => void callback(event, s)
    return { data: { subscription: { unsubscribe: vi.fn() } } } as never
  })
})

describe('AuthProvider', () => {
  it('저장된 세션이 있으면 새로고침해도 로그인 상태로 시작한다', async () => {
    getSession.mockResolvedValue({ data: { session }, error: null } as never)
    renderProvider()
    expect(screen.getByText('loading')).toBeInTheDocument()
    expect(await screen.findByText('signedIn')).toBeInTheDocument()
  })

  it('저장된 세션이 없으면 로그아웃 상태', async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null } as never)
    renderProvider()
    expect(await screen.findByText('signedOut')).toBeInTheDocument()
  })

  it('로그아웃되면 이전 계정의 데이터 캐시를 비운다', async () => {
    getSession.mockResolvedValue({ data: { session }, error: null } as never)
    const queryClient = renderProvider()
    await screen.findByText('signedIn')
    queryClient.setQueryData(['child'], { nickname: '하늘이' })

    act(() => emit('SIGNED_OUT', null))

    expect(await screen.findByText('signedOut')).toBeInTheDocument()
    expect(queryClient.getQueryData(['child'])).toBeUndefined()
  })
})
