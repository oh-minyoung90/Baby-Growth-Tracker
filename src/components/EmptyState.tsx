import type { LucideIcon } from 'lucide-react'
import { Plus } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

/**
 * 기록이 0건일 때 (FR-COM-20): 연보라 아이콘 상자 + 안내 문구 + "기록하기" 버튼 (docs/디자인.md 6장).
 * 버튼은 to(화면 이동) 또는 onAction(시트 열기 등) 중 하나로 동작한다.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel = '기록하기',
  to,
  onAction,
}: {
  icon: LucideIcon
  title: string
  description?: string
  actionLabel?: string
  to?: string
  onAction?: () => void
}) {
  return (
    <section className="flex flex-col items-center gap-3 rounded-card border bg-card px-5 py-10 text-center">
      <span className="flex size-16 items-center justify-center rounded-[20px] bg-soft text-soft-text">
        <Icon className="size-7" aria-hidden />
      </span>
      <strong className="text-[17px]">{title}</strong>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {to ? (
        <Button asChild className="mt-2">
          <Link to={to}>
            <Plus aria-hidden />
            {actionLabel}
          </Link>
        </Button>
      ) : (
        onAction && (
          <Button type="button" className="mt-2" onClick={onAction}>
            <Plus aria-hidden />
            {actionLabel}
          </Button>
        )
      )}
    </section>
  )
}
