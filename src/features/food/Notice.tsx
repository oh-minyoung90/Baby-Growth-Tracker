import { Info, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * 시트 안 안내 상자: 아이콘 + 제목 + 설명 (+ 버튼).
 * 보통은 연보라, 알러지·주의(caution)는 코랄 배경에 경고 아이콘을 쓴다 (docs/디자인.md 2.2, FR-FOOD-14)
 */
export function Notice({
  title,
  detail,
  action,
  tone = 'info',
}: {
  title: string
  detail: string
  action?: { label: string; onClick: () => void }
  tone?: 'info' | 'caution'
}) {
  const Icon = tone === 'caution' ? TriangleAlert : Info
  return (
    <div
      role="status"
      className={cn(
        'flex items-center gap-3 rounded-input px-3.5 py-3',
        tone === 'caution' ? 'bg-danger-soft text-danger-text' : 'bg-soft text-soft-text',
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 text-sm">
        <strong className="block">{title}</strong>
        {detail}
      </p>
      {action && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}
