import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider, type InitialEntry } from 'react-router'
import { routes } from '@/app/routes'
import { Toaster } from '@/components/ui/sonner'
import { AuthContext, type AuthState } from '@/lib/auth'

/**
 * 앱 전체 화면 이동을 테스트할 때 쓴다. 실제 Supabase 대신 원하는 로그인 상태를 넣고,
 * 데이터 조회 모듈(*Api.ts)은 각 테스트 파일에서 vi.mock으로 바꿔 끼운다.
 */
export function renderApp(entry: InitialEntry, auth: AuthState) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const router = createMemoryRouter(routes, { initialEntries: [entry] })
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext value={auth}>
        <RouterProvider router={router} />
      </AuthContext>
      <Toaster />
    </QueryClientProvider>,
  )
  return { router, queryClient }
}
