import { Navigate, Outlet } from 'react-router'
import { ErrorBanner } from '@/components/ErrorBanner'
import { FullScreenLoading } from '@/components/FullScreenLoading'
import { NETWORK_ERROR_MESSAGES } from '@/lib/messages'
import { useChild } from '@/lib/useChild'

/**
 * 아이 정보가 있어야 볼 수 있는 화면 (FR-CHILD-01).
 * 아이 정보가 없으면 등록 화면(/setup)으로 보낸다. 등록 전에는 다른 화면으로 갈 수 없다.
 */
export function RequireChild() {
  const { data: child, isPending, isError, refetch } = useChild()
  if (isPending) return <FullScreenLoading />
  if (isError) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-100 flex-col justify-center px-6">
        <ErrorBanner message={NETWORK_ERROR_MESSAGES.load} onRetry={() => void refetch()} />
      </div>
    )
  }
  if (!child) return <Navigate to="/setup" replace />
  return <Outlet />
}
