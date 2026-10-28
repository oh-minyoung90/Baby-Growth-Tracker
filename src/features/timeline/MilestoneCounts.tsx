import { MILESTONE_TYPES, type MilestoneType } from '@/lib/milestoneTypes'
import { cn } from '@/lib/utils'
import { TYPE_COLORS } from './timeline'

/**
 * 유형별 개수 (FR-TL-08~09): 단어·행동·표정 개수를 같은 폭 카드 3칸으로 보여 준다.
 * 누르면 그 유형만 보고, 그 상태면 선택 표시(보라색, docs/디자인.md 2.4)를 한다
 */
export function MilestoneCounts({
  counts,
  selected,
  onSelect,
}: {
  counts: Record<MilestoneType, number>
  selected: MilestoneType | null
  onSelect: (type: MilestoneType) => void
}) {
  return (
    <div role="group" aria-label="유형별 개수" className="grid min-w-0 flex-1 grid-cols-3 gap-2">
      {MILESTONE_TYPES.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={selected === value}
          aria-label={`${label} ${counts[value]}개`}
          onClick={() => onSelect(value)}
          className="group flex flex-col items-start gap-1 rounded-card border bg-surface px-3.5 py-3 text-left transition-colors aria-pressed:border-2 aria-pressed:border-primary aria-pressed:bg-soft aria-pressed:px-[13px] aria-pressed:py-[11px]"
        >
          <span className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground group-aria-pressed:text-soft-text">
            <span
              className={cn(
                'flex size-6 items-center justify-center rounded-lg',
                TYPE_COLORS[value],
              )}
            >
              <Icon className="size-3.5" aria-hidden />
            </span>
            {label}
          </span>
          <strong className="text-[22px] leading-tight tabular-nums group-aria-pressed:text-soft-text">
            {counts[value]}
            <span className="ml-0.5 text-sm font-medium">개</span>
          </strong>
        </button>
      ))}
    </div>
  )
}
