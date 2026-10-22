import { Navigate, Outlet, useLocation } from 'react-router'
import { FullScreenLoading } from '@/components/FullScreenLoading'
import { useAuth } from '@/lib/auth'

/** 로그인해야 볼 수 있는 화면. 로그인하지 않았으면 로그인 화면으로 보낸다 (FR-AUTH-06) */
export function RequireAuth() {
  const auth = useAuth()
  const location = useLocation()
  if (auth.status === 'loading') return <FullScreenLoading />
  if (auth.status === 'signedOut') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

/** 로그인 화면 등: 이미 로그인했으면 원래 가려던 화면(없으면 홈)으로 보낸다 */
export function RedirectIfSignedIn() {
  const auth = useAuth()
  const location = useLocation()
  if (auth.status === 'loading') return <FullScreenLoading />
  if (auth.status === 'signedIn') {
    const from = (location.state as { from?: unknown } | null)?.from
    // 앱 안의 주소만 허용한다 (외부 주소로 보내는 것을 막음)
    const target =
      typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/'
    return <Navigate to={target} replace />
  }
  return <Outlet />
}
