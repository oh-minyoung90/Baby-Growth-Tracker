import type { ReactNode } from 'react'
import { usePageTitle } from '@/lib/usePageTitle'
import { cn } from '@/lib/utils'

/**
 * 화면 본문 틀: 제목 + 내용. 본문 최대 폭은 960px, 주간 식단처럼 넓은 화면은 wide(1,280px) (docs/디자인.md 5장)
 */
export function Page({
  title,
  heading,
  description,
  wide = false,
  actions,
  children,
}: {
  /** 화면 이름. 브라우저 탭 제목이고, heading이 없으면 화면 제목이다 */
  title: string
  /** 화면 제목 자리에 title 대신 보여 줄 내용 (홈: 아이 이름 · 생후 일수) */
  heading?: ReactNode
  /** 제목 아래 한 줄 (홈: 오늘 날짜) */
  description?: ReactNode
  wide?: boolean
  actions?: ReactNode
  children: ReactNode
}) {
  usePageTitle(title)
  return (
    <div
      className={cn(
        'mx-auto flex w-full flex-col gap-5 px-5 pt-5 pb-6 md:px-12 md:pt-10',
        wide ? 'max-w-320' : 'max-w-240',
      )}
    >
      <header className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight md:text-[28px]">{heading ?? title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground md:text-[15px]">{description}</p>
          )}
        </div>
        {actions}
      </header>
      {children}
    </div>
  )
}
