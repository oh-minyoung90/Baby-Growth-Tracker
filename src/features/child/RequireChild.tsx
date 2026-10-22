import { Navigate, Outlet } from 'react-router'
import { Button } from '@/components/ui/button'
import { FullScreenLoading } from '@/components/FullScreenLoading'
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
      <div
        role="alert"
        className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center"
      >
        <p className="text-[15px]">정보를 불러오지 못했어요. 인터넷 연결을 확인해 주세요</p>
        <Button variant="outline" onClick={() => refetch()}>
          다시 시도
        </Button>
      </div>
    )
  }
  if (!child) return <Navigate to="/setup" replace />
  return <Outlet />
}
