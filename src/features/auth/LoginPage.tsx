import { Sprout } from 'lucide-react'
import { usePageTitle } from '@/lib/usePageTitle'

// 로그인 화면 자리. 이메일 6자리 코드 로그인은 T-10에서 만든다.
export function LoginPage() {
  usePageTitle('로그인')
  return (
    <main className="mx-auto flex min-h-dvh max-w-100 flex-col items-center justify-center gap-3.5 px-6 text-center">
      <span className="flex size-18 items-center justify-center rounded-[24px] bg-primary text-primary-foreground">
        <Sprout className="size-9" aria-hidden />
      </span>
      <h1 className="text-[26px] font-bold tracking-tight">Baby Growth Tracker</h1>
      <p className="text-[15px] text-muted-foreground">로그인 화면은 T-10에서 만들어요</p>
    </main>
  )
}
