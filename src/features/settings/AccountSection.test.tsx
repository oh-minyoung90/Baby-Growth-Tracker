import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Toaster } from '@/components/ui/sonner'
import { AuthContext, signOut, type AuthState } from '@/lib/auth'
import { AccountSection } from './AccountSection'

// 설정 > 계정: 로그아웃 (T-11, FR-SET-08)
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  signOut: vi.fn(),
}))
const mockedSignOut = vi.mocked(signOut)

const auth: AuthState = {
  status: 'signedIn',
  session: { user: { id: 'u1', email: 'parent@example.com' } } as Session,
}

function renderSection() {
  const router = createMemoryRouter(
    [
      { path: '/settings', element: <AccountSection /> },
      { path: '/login', element: <p>로그인 화면</p> },
    ],
    { initialEntries: ['/settings'] },
  )
  render(
    <AuthContext value={auth}>
      <RouterProvider router={router} />
      <Toaster />
    </AuthContext>,
  )
  return router
}

beforeEach(() => mockedSignOut.mockReset())

describe('계정 영역', () => {
  it('로그인한 이메일을 보여 준다', () => {
    renderSection()
    expect(screen.getByText('parent@example.com')).toBeInTheDocument()
  })

  it('로그아웃하면 로그인 화면으로 이동한다', async () => {
    mockedSignOut.mockResolvedValue({ ok: true })
    const router = renderSection()
    await userEvent.click(screen.getByRole('button', { name: '로그아웃' }))
    expect(mockedSignOut).toHaveBeenCalledOnce()
    expect(await screen.findByText('로그인 화면')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('로그아웃에 실패하면 안내하고 화면에 머문다', async () => {
    mockedSignOut.mockResolvedValue({ ok: false })
    const router = renderSection()
    await userEvent.click(screen.getByRole('button', { name: '로그아웃' }))
    expect(
      await screen.findByText('로그아웃하지 못했어요. 잠시 후 다시 시도해 주세요'),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/settings')
  })
})
