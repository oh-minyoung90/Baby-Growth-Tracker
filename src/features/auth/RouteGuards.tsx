import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './AuthContext'

function FullScreenLoading() {
  return (
    <div role="status" className="flex min-h-dvh items-center justify-center text-muted-foreground">
      불러오는 중…
    </div>
  )
}

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

/** 로그인 화면 등: 이미 로그인했으면 홈으로 보낸다 */
export function RedirectIfSignedIn() {
  const auth = useAuth()
  if (auth.status === 'loading') return <FullScreenLoading />
  if (auth.status === 'signedIn') return <Navigate to="/" replace />
  return <Outlet />
}
