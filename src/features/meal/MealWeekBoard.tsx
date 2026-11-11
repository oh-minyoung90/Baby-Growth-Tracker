import { useEffect, useRef, useState, type DragEventHandler } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import {
  Check,
  MessageSquare,
  Plus,
  Square,
  TriangleAlert,
  GripVertical,
  MoveRight,
} from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDateLabel, parseDate } from '@/domain/date'
import type { MealEntry } from '@/lib/mealApi'
import { MEAL_TYPES, mealIntakeLabel, type MealType } from '@/lib/mealTypes'
import { cn } from '@/lib/utils'

/** 모바일은 수평 스냅, PC는 7열. 주가 바뀌면 key로 다시 열어 이번 주는 오늘, 다른 주는 월요일부터 본다. */
export function MealWeekBoard({
  days,
  today,
  entries,
  onSelect,
  onEatenChange,
  pendingId,
  warningsReady = true,
  cautionIds = new Set<string>(),
  onMove,
  onDropMove,
  focusDate,
}: {
  days: string[]
  today: string
  entries: MealEntry[]
  onSelect?: (date: string, type: MealType, entry?: MealEntry) => void
  onEatenChange?: (entry: MealEntry, eaten: boolean) => void
  pendingId?: string
  warningsReady?: boolean
  onMove?: (entry: MealEntry) => void
  onDropMove?: (entry: MealEntry, date: string, type: MealType) => void
  focusDate?: string
  cautionIds?: ReadonlySet<string>
}) {
  const [dragging, setDragging] = useState<MealEntry | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const initialDay =
    focusDate && days.includes(focusDate) ? focusDate : days.includes(today) ? today : days[0]
  const [active, setActive] = useState(initialDay)
  const initialIndex = days.indexOf(initialDay)
  const scroller = useRef<HTMLDivElement>(null)
  const cards = useRef<(HTMLElement | null)[]>([])
  const scrollTo = (index: number, behavior: ScrollBehavior) => {
    scroller.current?.scrollTo?.({ left: cards.current[index]?.offsetLeft ?? 0, behavior })
  }
  useEffect(() => {
    scrollTo(initialIndex, 'auto')
  }, [initialIndex])

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div role="group" aria-label="식단 요일" className="grid grid-cols-7 gap-1 md:hidden">
        {days.map((date, index) => {
          const recorded = entries.some((entry) => entry.date === date)
          return (
            <button
              key={date}
              type="button"
              aria-pressed={active === date}
              aria-label={`${formatDateLabel(date)}${recorded ? ' · 기록 있음' : ''}`}
              onClick={() => {
                setActive(date)
                scrollTo(index, 'smooth')
              }}
              className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-button border border-transparent text-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-primary aria-pressed:bg-soft aria-pressed:font-bold aria-pressed:text-soft-text"
            >
              {format(parseDate(date), 'EEE', { locale: ko })}
              <span
                className={cn('size-1 rounded-full', recorded ? 'bg-primary' : 'bg-transparent')}
                aria-hidden
              />
            </button>
          )
        })}
      </div>
      <div
        ref={scroller}
        aria-label="주간 식단표"
        onScroll={() => {
          const left = scroller.current?.scrollLeft ?? 0
          const nearest = cards.current.reduce(
            (best, card, index) =>
              Math.abs((card?.offsetLeft ?? 0) - left) <
              Math.abs((cards.current[best]?.offsetLeft ?? 0) - left)
                ? index
                : best,
            0,
          )
          setActive(days[nearest])
        }}
        className="relative flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-2 md:grid md:grid-cols-[repeat(7,minmax(8rem,1fr))] md:gap-2"
      >
        {days.map((date, index) => (
          <section
            key={date}
            ref={(node) => {
              cards.current[index] = node
            }}
            aria-label={formatDateLabel(date)}
            className={cn(
              'flex w-full min-w-0 shrink-0 snap-start flex-col overflow-hidden rounded-card border bg-surface md:w-auto',
              date === today && 'border-primary',
            )}
          >
            <header
              className={cn(
                'flex min-h-14 shrink-0 items-center justify-center gap-2 border-b px-2 py-3 md:h-20 md:flex-col md:gap-1',
                date === today && 'bg-soft',
              )}
            >
              <h3 className="text-base font-bold md:text-sm">
                {format(parseDate(date), 'M. d. (EEE)', { locale: ko })}
              </h3>
              {date === today && <Badge variant="soft">오늘</Badge>}
            </header>
            <div className="flex flex-1 flex-col gap-2 p-3 md:p-2">
              {MEAL_TYPES.map((type) => {
                const entry = entries.find((item) => item.date === date && item.type === type.value)
                return (
                  <MealCell
                    key={type.value}
                    entry={entry}
                    onMove={entry && onMove ? () => onMove(entry) : undefined}
                    onDragStart={
                      entry && onDropMove
                        ? (event) => {
                            if (pendingId || !window.matchMedia('(min-width: 768px)').matches) {
                              event.preventDefault()
                              return
                            }
                            event.dataTransfer.setData('application/x-baby-growth-meal', entry.id)
                            event.dataTransfer.effectAllowed = 'move'
                            setDragging(entry)
                          }
                        : undefined
                    }
                    onDragEnd={() => {
                      setDragging(null)
                      setDropTarget(null)
                    }}
                    onDragOver={(event) => {
                      if (!dragging || pendingId) return
                      event.preventDefault()
                      event.dataTransfer.dropEffect = 'move'
                      setDropTarget(`${date}:${type.value}`)
                    }}
                    onDrop={(event) => {
                      if (!dragging || pendingId) return
                      event.preventDefault()
                      const source = entries.find((item) => item.id === dragging.id)
                      if (
                        source &&
                        event.dataTransfer.getData('application/x-baby-growth-meal') ===
                          source.id &&
                        (source.date !== date || source.type !== type.value)
                      )
                        onDropMove?.(source, date, type.value)
                      setDragging(null)
                      setDropTarget(null)
                    }}
                    dropActive={dropTarget === `${date}:${type.value}`}
                    label={type.label}
                    checkLabel={`${formatDateLabel(date)} ${type.label} 먹음`}
                    onEatenChange={
                      entry && onEatenChange ? (eaten) => onEatenChange(entry, eaten) : undefined
                    }
                    disabled={!!pendingId || date > today || (!entry?.eaten && !warningsReady)}
                    editingDisabled={!!pendingId}
                    pending={!!entry && entry.id === pendingId}
                    caution={!!entry && cautionIds.has(entry.id)}
                    onSelect={onSelect ? () => onSelect(date, type.value, entry) : undefined}
                  />
                )
              })}
            </div>
          </section>
        ))}
      </div>
      <p className="text-center text-[13px] text-muted-foreground md:hidden">
        좌우로 넘겨 다른 요일의 식단을 볼 수 있어요
      </p>
    </div>
  )
}

function MealCell({
  entry,
  label,
  onSelect,
  onEatenChange,
  checkLabel,
  disabled,
  pending,
  editingDisabled,
  caution,
  onMove,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  dropActive,
}: {
  entry?: MealEntry
  label: string
  onSelect?: () => void
  onEatenChange?: (eaten: boolean) => void
  checkLabel: string
  disabled: boolean
  pending: boolean
  editingDisabled: boolean
  caution: boolean
  onMove?: () => void
  onDragStart?: DragEventHandler<HTMLButtonElement>
  onDragEnd: DragEventHandler<HTMLButtonElement>
  onDragOver: DragEventHandler<HTMLDivElement>
  onDrop: DragEventHandler<HTMLDivElement>
  dropActive: boolean
}) {
  const names = entry ? [...entry.foods, ...entry.recipes].map((item) => item.name).join(', ') : ''
  const content = entry ? (
    <>
      <span className="text-[15px] leading-relaxed break-words md:text-sm">{names}</span>
      <span className="flex flex-wrap items-center gap-1.5">
        {!entry.eaten && <Badge variant="plan">계획</Badge>}
        {caution && (
          <Badge variant="caution">
            <TriangleAlert aria-hidden />
            주의
          </Badge>
        )}
        {entry.intake && (
          <span className="text-xs text-muted-foreground">{mealIntakeLabel(entry.intake)}</span>
        )}
        {entry.memo && (
          <MessageSquare className="size-3.5 text-muted-foreground" aria-label="메모 있음" />
        )}
      </span>
    </>
  ) : (
    <>
      <span className="text-sm font-bold">{label}</span>
      <span className="flex items-center gap-1 text-sm text-muted-foreground">
        <Plus className="size-4" aria-hidden />
        추가
      </span>
    </>
  )
  const contentClass =
    'flex w-full min-w-0 flex-1 flex-col gap-2 rounded-button p-3 text-left md:p-2'
  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        'flex min-h-28 w-full flex-col rounded-button border md:min-h-36',
        !entry || !entry.eaten ? 'border-dashed bg-muted/40' : 'bg-surface',
        dropActive && 'ring-2 ring-primary bg-soft',
      )}
    >
      {entry && (
        <div className="flex min-h-11 items-center justify-between gap-1 pl-3 md:pl-2">
          <span className="text-sm font-bold">{label}</span>
          {onEatenChange ? (
            <span className="grid size-11 shrink-0 place-items-center">
              <Checkbox
                checked={entry.eaten}
                disabled={disabled}
                aria-label={checkLabel}
                aria-busy={pending}
                onCheckedChange={(checked) => onEatenChange(checked === true)}
              />
            </span>
          ) : entry.eaten ? (
            <Check className="mr-2 size-4 text-tried-text" aria-label="먹음" />
          ) : (
            <Square className="mr-2 size-4 text-muted-foreground" aria-label="계획" />
          )}
        </div>
      )}
      {entry && onMove && (
        <div className="flex items-center justify-between gap-1 px-2">
          {onDragStart && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden w-7 cursor-grab md:inline-flex active:cursor-grabbing"
              draggable={!editingDisabled}
              disabled={editingDisabled}
              aria-label={`${label} 식단 드래그로 이동`}
              title="다른 날짜·끼니로 끌어 이동"
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            >
              <GripVertical className="size-4" aria-hidden />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto"
            disabled={editingDisabled}
            aria-label={`${label} 식단 이동`}
            onClick={onMove}
          >
            <MoveRight className="size-4" aria-hidden />
            이동
          </Button>
        </div>
      )}
      {onSelect ? (
        <button
          type="button"
          disabled={editingDisabled}
          aria-label={`${label} ${entry ? `식단 수정: ${names}` : '식단 추가'}`}
          className={cn(
            contentClass,
            'outline-none transition-colors hover:bg-soft focus-visible:ring-2 focus-visible:ring-ring',
          )}
          onClick={onSelect}
        >
          {content}
        </button>
      ) : (
        <div className={contentClass}>{content}</div>
      )}
    </div>
  )
}
