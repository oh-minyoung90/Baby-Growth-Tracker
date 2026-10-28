import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
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
 * 모바일은 아이콘 + 두세 줄 카드, PC는 날짜 칸 · 유형 · 내용 · 메모를 한 줄로 둔다 (시안 D-04)
 */
function TimelineRow({ item, age }: { item: TimelineItem; age: string | null }) {
  const { label, icon: Icon } = timelineTypeInfo(item.type)
  return (
    <Link
      to={item.to}
      className="grid grid-cols-[40px_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-2xl border bg-surface px-4 py-3.5 transition-colors outline-none hover:bg-muted focus-visible:bg-muted md:flex md:items-center md:gap-3.5 md:px-[18px]"
    >
      <span
        className={cn(
          'flex size-10 items-center justify-center rounded-xl md:hidden',
          item.memo ? 'row-span-3' : 'row-span-2',
          TYPE_COLORS[item.type],
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      {/* PC에서는 묶음을 풀어 날짜 칸이 맨 앞, 유형이 그다음에 온다 */}
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 md:contents">
        <Badge variant={item.type} className="md:order-2">
          {label}
        </Badge>
        <span className="text-[13px] text-muted-foreground md:order-1 md:flex md:w-32 md:shrink-0 md:flex-col">
          <span>{formatDateLabel(item.date)}</span>
          {age && (
            <>
              <span className="md:hidden"> · </span>
              <span>{age}</span>
            </>
          )}
        </span>
      </span>
      <strong className="text-[17px] break-words md:order-3 md:shrink-0 md:text-base">
        {item.title}
      </strong>
      {item.memo && (
        <span className="truncate text-sm text-muted-foreground md:order-4 md:min-w-0">
          {item.memo}
        </span>
      )}
    </Link>
  )
}
