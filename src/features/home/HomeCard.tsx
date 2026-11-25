import { useId, type ReactNode } from 'react'
import meal from '@/assets/home/meal.svg'
import growth from '@/assets/home/growth.svg'
import sleep from '@/assets/home/sleep.svg'
import prep from '@/assets/home/prep.svg'
import measure from '@/assets/home/measure.svg'
import { cn } from '@/lib/utils'

const icons = { meal, growth, sleep, prep, measure }

export function HomeCard({
  title,
  icon,
  action,
  className,
  summary,
  children,
}: {
  title: string
  icon: keyof typeof icons
  action?: ReactNode
  summary?: boolean
  className?: string
  children?: ReactNode
}) {
  const id = useId()
  return (
    <section
      aria-labelledby={id}
      className={cn(
        'flex min-w-0 flex-col',
        summary ? 'border-b py-1' : 'gap-2 rounded-card border bg-surface p-4',
        className,
      )}
    >
      <div className="flex min-h-11 min-w-0 items-center justify-between gap-2">
        <h2 id={id} className="flex shrink-0 items-center gap-2 text-[15px] leading-6 font-bold">
          <img alt="" src={icons[icon]} className="size-[34px] shrink-0" />
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}
