import type { ReactNode } from 'react'
import { usePageTitle } from '@/lib/usePageTitle'
import { cn } from '@/lib/utils'

/**
 * 화면 본문 틀: 제목 + 내용. 본문 최대 폭은 960px, 주간 식단처럼 넓은 화면은 wide(1,280px) (docs/디자인.md 5장)
 */
export function Page({
  title,
  wide = false,
  actions,
  children,
}: {
  title: string
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
        <h1 className="text-2xl font-bold tracking-tight md:text-[28px]">{title}</h1>
        {actions}
      </header>
      {children}
    </div>
  )
}
