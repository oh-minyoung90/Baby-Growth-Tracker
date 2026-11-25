import { Link } from 'react-router'
import { ageLabel } from '@/domain/age'
import { formatDateLabel } from '@/domain/date'
import { cn } from '@/lib/utils'
import { TYPE_COLORS, groupByMonth, timelineTypeInfo, type TimelineItem } from './timeline'

/** 월별로 묶은 타임라인 (FR-TL-01~02). 누르면 그 기록의 수정 화면이 열린다 (FR-COM-30) */
export function TimelineList({
  items,
  birthDate,
}: {
  items: readonly TimelineItem[]
  birthDate: string | undefined
}) {
  return (
    <div className="flex flex-col gap-5">
      {groupByMonth(items).map((group) => (
        <section
          key={group.month}
          aria-labelledby={`month-${group.month}`}
          className="flex flex-col gap-2.5"
        >
          <h2 id={`month-${group.month}`} className="text-sm font-bold text-muted-foreground">
            {group.label}
          </h2>
          <ul className="flex flex-col gap-2.5">
            {group.items.map((item) => (
              <li key={item.key}>
                <TimelineRow item={item} age={ageLabel(birthDate, item.date)} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/**
 * 한 줄: 날짜·생후 일수, 유형, 내용, 메모 1줄 (FR-TL-02).
 * 모바일·PC 모두 유형 아이콘 + 날짜·생후 일수 + 내용·메모 카드로 표시한다.
 */
function TimelineRow({ item, age }: { item: TimelineItem; age: string | null }) {
  const { label, icon: Icon } = timelineTypeInfo(item.type)
  return (
    <Link
      to={item.to}
      className="grid grid-cols-[36px_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-2xl border bg-surface px-4 py-3.5 transition-colors outline-none hover:bg-muted focus-visible:bg-muted"
    >
      <span
        className={cn(
          'flex size-9 items-center justify-center self-center rounded-xl',
          item.memo ? 'row-span-3' : 'row-span-2',
          TYPE_COLORS[item.type],
        )}
      >
        <Icon className="size-5" aria-hidden />
        <span className="sr-only">{label}</span>
      </span>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[13px] text-muted-foreground">
          <span>{formatDateLabel(item.date)}</span>
          {age && (
            <>
              <span> · </span>
              <span>{age}</span>
            </>
          )}
        </span>
      </span>
      <strong className="min-w-0 text-[15px] break-words">{item.title}</strong>
      {item.memo && <span className="truncate text-[13px] text-muted-foreground">{item.memo}</span>}
    </Link>
  )
}
