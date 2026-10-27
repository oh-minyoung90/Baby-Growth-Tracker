import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/lib/usePageTitle'

/**
 * 화면 전환으로 여는 입력 화면의 틀: 발달 기록, 수면, 레시피 편집 (docs/디자인.md 5장).
 * - 모바일: 위쪽에 뒤로 가기 + 제목, 아래쪽에 고정된 버튼 줄(FormActions). 하단 탭은 숨긴다 (라우트 handle.hideBottomNav)
 * - PC: 왼쪽 메뉴는 그대로 두고, 본문 폭은 560px
 */
export function FormPage({
  title,
  onBack,
  children,
}: {
  title: string
  onBack: () => void
  children: ReactNode
}) {
  usePageTitle(title)
  return (
    <div className="mx-auto flex w-full max-w-140 flex-col md:px-12 md:pt-10">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-1 border-b bg-surface px-2 md:static md:h-auto md:border-0 md:bg-transparent md:px-0 md:pb-6">
        <Button type="button" variant="ghost" size="icon" aria-label="뒤로" onClick={onBack}>
          <ChevronLeft className="size-5.5" aria-hidden />
        </Button>
        <h1 className="text-lg font-bold md:text-[28px] md:tracking-tight">{title}</h1>
      </header>
      {/* 모바일에서 고정된 버튼 줄이 마지막 입력칸을 가리지 않게 아래를 비운다 */}
      <div className="px-5 pt-5 pb-[calc(112px+env(safe-area-inset-bottom))] md:px-0 md:pt-0 md:pb-10">
        {children}
      </div>
    </div>
  )
}

/** 입력 화면 아래 버튼 줄 (취소·저장). 모바일은 화면 아래에 고정, PC는 폼 끝에 둔다 */
export function FormActions({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 gap-2.5 border-t bg-background px-5 pt-3 pb-[calc(20px+env(safe-area-inset-bottom))] md:static md:mt-3 md:border-0 md:bg-transparent md:p-0">
      {children}
    </div>
  )
}
