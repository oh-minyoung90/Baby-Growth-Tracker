import { useId, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/** 홈 요약 카드의 폭·제목·아이콘·간격을 통일한다. */
export function HomeCard({
  title,
  icon: Icon,
  action,
  className,
  children,
}: {
  title: string
  icon: LucideIcon
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  const id = useId()
  return (
    <section
      aria-labelledby={id}
      className={cn('flex min-w-0 flex-col gap-3 rounded-card border bg-surface p-4', className)}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <h2
          id={id}
          className="flex min-w-0 items-center gap-2 text-base leading-6 font-bold text-foreground"
        >
          <Icon className="size-5 shrink-0 text-soft-text" aria-hidden />
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}
