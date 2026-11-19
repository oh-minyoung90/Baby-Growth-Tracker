import { cn } from '@/lib/utils'
import { TIMELINE_TYPE_VALUES, TYPE_COLORS, timelineTypeInfo, type TimelineType } from './timeline'

/** 누적 개수와 유형 선택을 통합한다. 기간과 무관한 전체 개수다. */
export function TimelineTypeCards({
  counts,
  selected,
  onSelect,
}: {
  counts: Record<TimelineType, number>
  selected: TimelineType | null
  onSelect: (type: TimelineType) => void
}) {
  return (
    <div
      role="group"
      aria-label="유형별 개수"
      className="grid min-w-0 grid-cols-2 gap-2.5 lg:grid-cols-4"
    >
      {TIMELINE_TYPE_VALUES.map((type) => {
        const { label, icon: Icon } = timelineTypeInfo(type)
        return (
          <button
            key={type}
            type="button"
            aria-pressed={selected === type}
            aria-label={`${label} ${counts[type]}개`}
            onClick={() => onSelect(type)}
            className="group flex h-13 min-w-0 items-center justify-between gap-1.5 rounded-card border bg-surface px-3 py-2 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40 aria-pressed:border-2 aria-pressed:border-primary aria-pressed:bg-soft aria-pressed:px-[11px] aria-pressed:py-[7px] lg:h-auto lg:min-h-26 lg:flex-col lg:items-start lg:gap-2 lg:px-3.5 lg:py-3.5 lg:aria-pressed:px-[13px] lg:aria-pressed:py-[13px]"
          >
            <span className="flex min-w-0 items-center gap-1.5 text-[13px] leading-[18px] font-medium break-keep text-muted-foreground group-aria-pressed:text-soft-text">
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-lg max-[360px]:hidden',
                  TYPE_COLORS[type],
                )}
              >
                <Icon className="size-4" aria-hidden />
              </span>
              {label}
            </span>
            <strong className="shrink-0 text-[15px] leading-5 whitespace-nowrap tabular-nums group-aria-pressed:text-soft-text lg:text-2xl lg:leading-tight">
              {counts[type]}
              <span className="ml-0.5 text-[13px] font-medium lg:text-sm">개</span>
            </strong>
          </button>
        )
      })}
    </div>
  )
}
