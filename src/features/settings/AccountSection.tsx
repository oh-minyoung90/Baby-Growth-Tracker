import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { signOut, useAuth } from '@/lib/auth'

/** 설정 > 계정: 로그인한 이메일과 로그아웃 (FR-SET-08) */
export function AccountSection() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  const email = auth.status === 'signedIn' ? auth.session.user.email : undefined

  const onSignOut = async () => {
    setPending(true)
    const result = await signOut()
    setPending(false)
    if (!result.ok) {
      toast.error('로그아웃하지 못했어요. 잠시 후 다시 시도해 주세요')
      return
    }
    // 다음에 로그인하면 홈부터 보이도록 로그인 화면으로 직접 보낸다
    navigate('/login', { replace: true })
  }

  return (
    <section aria-labelledby="settings-account" className="flex flex-col gap-2">
      <h2 id="settings-account" className="text-[13px] font-bold text-muted-foreground">
        계정
      </h2>
      <div className="flex items-center justify-between gap-3 rounded-[18px] border bg-card py-2 pr-2 pl-4">
        <span className="min-w-0 truncate text-sm text-muted-foreground">{email}</span>
        <Button
          variant="ghost"
          size="sm"
          className="font-bold text-soft-text"
          disabled={pending}
          onClick={onSignOut}
        >
          {pending ? '로그아웃 중…' : '로그아웃'}
        </Button>
      </div>
    </section>
  )
}
