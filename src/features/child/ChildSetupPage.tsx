import { Navigate, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { signOut } from '@/lib/auth'
import { FullScreenLoading } from '@/components/FullScreenLoading'
import { usePageTitle } from '@/lib/usePageTitle'
import { ChildForm } from './ChildForm'
import { useChild } from '@/lib/useChild'

/** 첫 로그인 후 아이 정보 등록 (SCR-02, FR-CHILD-01). 저장하기 전에는 다른 화면으로 갈 수 없다 */
export function ChildSetupPage() {
  usePageTitle('아이 정보 등록')
  const navigate = useNavigate()
  const { data: child, isPending } = useChild()

  if (isPending) return <FullScreenLoading />
  // 이미 등록했다면 수정은 설정에서 한다
  if (child) return <Navigate to="/" replace />

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-100 flex-col gap-7 px-6 pt-8 pb-8">
      <div className="flex justify-end">
        {/* 다른 계정으로 잘못 로그인한 경우를 위해 로그아웃만 열어 둔다 */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void signOut().then(() => navigate('/login'))}
        >
          로그아웃
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold text-soft-text">처음 한 번만 입력해요</span>
        <h1 className="text-[26px] leading-snug font-bold tracking-tight">
          아이 정보를
          <br />
          알려 주세요
        </h1>
        <p className="text-[15px] text-muted-foreground">
          생년월일로 기록마다 생후 며칠인지 계산해 드려요
        </p>
      </div>
      <ChildForm mode="create" onSaved={() => navigate('/', { replace: true })} />
    </main>
  )
}
