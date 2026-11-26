import { useRef, useState, type ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import type { LucideIcon } from 'lucide-react'
import { ChevronRight, Camera, Plus, Sprout } from 'lucide-react'
import { Link } from 'react-router'
import { ChildAvatar } from '@/components/ChildAvatar'
import { ErrorBanner } from '@/components/ErrorBanner'
import { ListLoading } from '@/components/ListLoading'
import { Page } from '@/components/Page'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { ageLabel } from '@/domain/age'
import { formatDateLabel, todayString, yesterdayString } from '@/domain/date'
import { formatTotalSleep } from '@/domain/sleep'
import type { BodyMeasure } from '@/lib/bodyApi'
import { formatMeasureValue } from '@/lib/bodyFormat'
import { NETWORK_ERROR_MESSAGES } from '@/lib/messages'
import type { Milestone } from '@/lib/milestoneApi'
import { MILESTONE_TYPES } from '@/lib/milestoneTypes'
import type { SleepLog } from '@/lib/sleepApi'
import { summarizeSleepLog } from '@/lib/sleepSummary'
import { useBodyMeasures } from '@/lib/useBodyMeasures'
import { useChild } from '@/lib/useChild'
import { useMilestones } from '@/lib/useMilestones'
import { useMealDay } from '@/lib/useMeals'
import { MEAL_TYPES } from '@/lib/mealTypes'
import type { MealEntry } from '@/lib/mealApi'
import { useSleepLogs } from '@/lib/useSleepLogs'
import { ShoppingCard } from './ShoppingCard'
import { HomeCard as Card } from './HomeCard'
import { cn } from '@/lib/utils'

interface RecordChoice {
  to: string
  label: string
  icon?: LucideIcon
}

const GROWTH_RECORDS: readonly RecordChoice[] = MILESTONE_TYPES.map(({ value, label, icon }) => ({
  to: `/milestones/new?type=${value}`,
  label,
  icon,
}))

const HEADER_ACTION_CLASS =
  'inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-button px-2 text-sm font-bold text-soft-text outline-none hover:bg-soft-hover focus-visible:bg-soft-hover focus-visible:ring-3 focus-visible:ring-ring/40'

/**
 * 홈 (SCR-03): 식단 → 오늘 기록 → 어젯밤 수면 → 준비 목록 → 최근 측정.
 * 모바일·PC 모두 한 열로 배치한다 (docs/디자인.md 5.1).
 */
export function HomePage() {
  const { data: child } = useChild()
  const milestones = useMilestones()
  const sleepLogs = useSleepLogs()
  const measures = useBodyMeasures()

  const today = todayString()
  const meals = useMealDay(today)
  const age = child ? ageLabel(child.birthDate, today) : null
  const failed = [milestones, sleepLogs, measures, meals].filter((query) => query.isError)

  return (
    <Page
      title="홈"
      profileHeader={
        child && (
          <>
            <div className="flex h-[52px] items-center gap-[7px] md:hidden">
              <Sprout className="size-5.5 text-primary" aria-hidden />
              <span className="text-[17px] font-bold tracking-[-0.045em]">MyBabyLog</span>
            </div>
            <div className="flex flex-col items-center px-12 pt-3 text-center md:pt-0">
              <Link
                to="/settings/child"
                state={{ fromHome: true }}
                aria-label="아이 프로필 사진 편집"
                className="relative mb-2.5 rounded-full focus-visible:ring-3 focus-visible:ring-ring"
              >
                <ChildAvatar photo={child.profilePhoto} />
                <span className="absolute right-0 bottom-0 rounded-full border border-surface bg-soft p-1 text-soft-text">
                  <Camera className="size-3" aria-hidden />
                </span>
              </Link>
              <h1 className="max-w-full text-[17px] font-bold break-all">{child.nickname}</h1>
              {age && <p className="mt-[5px] text-sm font-bold">{age}</p>}
              <time dateTime={child.birthDate} className="mt-1 text-xs text-muted-foreground">
                ({child.birthDate.replaceAll('-', '.')})
              </time>
            </div>
          </>
        )
      }
    >
      {failed.length > 0 && (
        <ErrorBanner
          message={NETWORK_ERROR_MESSAGES.load}
          onRetry={() => failed.forEach((query) => void query.refetch())}
          retrying={failed.some((query) => query.isFetching)}
        />
      )}

      <MealCard query={meals} today={today} />
      <TodayCard query={milestones} today={today} />
      <div>
        <SleepCard query={sleepLogs} yesterday={yesterdayString()} />
        <ShoppingCard />
        <MeasureCard query={measures} />
      </div>
    </Page>
  )
}

/** 불러오는 중이면 로딩 표시, 실패하면 안내(다시 시도는 화면 위 배너), 불러왔으면 내용 */
function QueryContent<T>({
  query,
  children,
}: {
  query: UseQueryResult<T>
  children: (data: T) => ReactNode
}) {
  if (query.isPending) return <ListLoading rows={1} />
  if (query.isError) return <p className="text-sm text-muted-foreground">불러오지 못했어요</p>
  return children(query.data)
}

const CARD_ACTION_CLASS =
  'flex min-h-11 items-center gap-0.5 self-start text-sm font-bold text-soft-text outline-none hover:underline focus-visible:underline'

/** 0건일 때 입력 화면으로 가는 글자 버튼 (시안: "어젯밤 수면 기록하기 ›") */
function CardAction({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={CARD_ACTION_CLASS}>
      {children}
      <ChevronRight className="size-4" aria-hidden />
    </Link>
  )
}

/**
 * 오늘의 기록 (FR-HOME-02, 06): 기록 날짜가 오늘인 발달 기록. 입력한 시각이 아니라 기록 날짜 기준이다.
 * 누르면 그 기록의 수정 화면이 열린다 (FR-COM-30)
 */
function TodayCard({ query, today }: { query: UseQueryResult<Milestone[]>; today: string }) {
  const hasRecords = query.isSuccess && query.data.some((record) => record.date === today)
  return (
    <Card
      title="오늘의 기록"
      icon="growth"
      className={hasRecords ? 'bg-cream' : undefined}
      action={
        hasRecords && (
          <GrowthRecordAction className={HEADER_ACTION_CLASS} ariaLabel="성장 기록 추가">
            <Plus className="size-4" aria-hidden />
            추가
          </GrowthRecordAction>
        )
      }
    >
      <QueryContent query={query}>
        {(milestones) => {
          const records = milestones.filter((record) => record.date === today)
          if (records.length === 0) {
            return (
              <GrowthRecordAction className={CARD_ACTION_CLASS}>
                오늘 성장 기록하기
                <ChevronRight className="size-4" aria-hidden />
              </GrowthRecordAction>
            )
          }
          const rows = MILESTONE_TYPES.flatMap(({ value, label }) => {
            const record = records.find((item) => item.type === value)
            return record ? [{ record, label }] : []
          })
          return (
            <div>
              <ul className="divide-y rounded-input border bg-surface">
                {rows.map(({ record, label }) => (
                  <li key={record.id} className="flex min-h-12 items-baseline gap-2.5 px-3 text-sm">
                    <strong className="shrink-0 text-[15px]">{label}</strong>
                    <Link
                      aria-label={`${label} ${record.title}`}
                      className="min-w-0 rounded-input py-3 wrap-anywhere hover:underline focus-visible:underline"
                      to={`/milestones/${record.id}`}
                    >
                      {record.title}
                    </Link>
                  </li>
                ))}
              </ul>
              {records.length > rows.length && (
                <Link
                  className={CARD_ACTION_CLASS}
                  to={`/growth/timeline?period=custom&from=${today}&to=${today}`}
                >
                  오늘 기록 {records.length}개 보기 <ChevronRight aria-hidden className="size-4" />
                </Link>
              )}
            </div>
          )
        }}
      </QueryContent>
    </Card>
  )
}

const SUMMARY_LINK_CLASS =
  'inline-flex min-h-11 min-w-11 flex-wrap items-center justify-end gap-x-1 text-right text-sm font-normal text-foreground hover:underline focus-visible:underline'

function SleepCard({ query, yesterday }: { query: UseQueryResult<SleepLog[]>; yesterday: string }) {
  const log = query.isSuccess && query.data.find((item) => item.date === yesterday)
  const total = log ? formatTotalSleep(summarizeSleepLog(log)?.totalMinutes ?? null) : null
  return (
    <Card
      title="어젯밤 수면"
      icon="sleep"
      summary
      action={
        log && (
          <Link
            to={`/sleep/${log.id}`}
            className={SUMMARY_LINK_CLASS}
            aria-label={`어젯밤 수면 수정, 총 ${total}`}
          >
            총 <span>{total}</span>
          </Link>
        )
      }
    >
      {!log && (
        <QueryContent query={query}>
          {() => <CardAction to="/sleep/new">어젯밤 수면 기록하기</CardAction>}
        </QueryContent>
      )}
    </Card>
  )
}

function MeasureCard({ query }: { query: UseQueryResult<BodyMeasure[]> }) {
  const latest = query.isSuccess && query.data[0]
  return (
    <Card
      title="최근 측정"
      icon="measure"
      summary
      action={
        latest && (
          <Link
            to="/growth/body?record=new"
            className={SUMMARY_LINK_CLASS}
            aria-label={`키·몸무게 기록 추가, 최근 측정 ${formatMeasureValue(latest.heightCm, 'cm')} · ${formatMeasureValue(latest.weightKg, 'kg')}`}
          >
            <span>{formatMeasureValue(latest.heightCm, 'cm')}</span> ·{' '}
            <span>{formatMeasureValue(latest.weightKg, 'kg')}</span>
          </Link>
        )
      }
    >
      {!latest && (
        <QueryContent query={query}>
          {() => <CardAction to="/growth/body?record=new">키·몸무게 기록하기</CardAction>}
        </QueryContent>
      )}
    </Card>
  )
}

/** 카드별 기록 종류를 고르는 공통 시트. 입력 경로로 이동하면 닫히고, 취소 시 원래 버튼에 초점을 돌린다. */
function RecordPickerAction({
  className,
  children,
  ariaLabel,
  title,
  description,
  options,
}: {
  className: string
  children: ReactNode
  ariaLabel?: string
  title: string
  description: string
  options: readonly RecordChoice[]
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={className}
      >
        {children}
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            triggerRef.current?.focus()
          }}
        >
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
          <div
            className={cn(
              'grid gap-3',
              options.length === 3
                ? 'grid-cols-3'
                : options.length >= 2
                  ? 'grid-cols-2'
                  : 'grid-cols-1',
            )}
          >
            {options.map(({ to, label, icon: Icon }) => (
              <Link
                key={label}
                to={to}
                onClick={() => setOpen(false)}
                className="flex min-h-16 min-w-0 flex-col items-center justify-center gap-2 rounded-button border bg-surface px-2 py-3 text-sm font-bold outline-none hover:bg-soft focus-visible:ring-3 focus-visible:ring-ring/40"
              >
                {Icon && <Icon className="size-5 shrink-0 text-soft-text" aria-hidden />}
                {label}
              </Link>
            ))}
          </div>
          <Button variant="soft" onClick={() => setOpen(false)}>
            취소
          </Button>
        </SheetContent>
      </Sheet>
    </>
  )
}

function GrowthRecordAction(props: { className: string; children: ReactNode; ariaLabel?: string }) {
  return (
    <RecordPickerAction
      {...props}
      title="성장 기록"
      description="어떤 기록을 남길까요?"
      options={GROWTH_RECORDS}
    />
  )
}

function MealRecordAction({
  today,
  options,
  ...props
}: {
  today: string
  options: readonly (typeof MEAL_TYPES)[number][]
  className: string
  children: ReactNode
  ariaLabel?: string
}) {
  return (
    <RecordPickerAction
      {...props}
      title="끼니 선택"
      description={`${formatDateLabel(today)}에 기록할 끼니를 골라 주세요`}
      options={options.map(({ value, label }) => ({
        label,
        to: `/meals/week?date=${today}&meal=${value}&record=new`,
      }))}
    />
  )
}

/** 계획과 먹은 기록을 모두 표시하며 누르면 그 식단의 수정 시트를 연다. */
function MealCard({ query, today }: { query: UseQueryResult<MealEntry[]>; today: string }) {
  const remaining = MEAL_TYPES.filter(
    ({ value }) => !query.data?.some((entry) => entry.type === value),
  )
  const showAdd = query.isSuccess && query.data.length > 0 && remaining.length > 0
  return (
    <Card
      title="오늘의 식단"
      icon="meal"
      className="bg-cream"
      action={
        showAdd && (
          <MealRecordAction
            today={today}
            options={remaining}
            className={HEADER_ACTION_CLASS}
            ariaLabel="식단 추가"
          >
            <Plus className="size-4" aria-hidden />
            추가
          </MealRecordAction>
        )
      }
    >
      <QueryContent query={query}>
        {(entries) =>
          entries.length === 0 ? (
            <MealRecordAction today={today} options={MEAL_TYPES} className={CARD_ACTION_CLASS}>
              오늘 식단 기록하기
              <ChevronRight className="size-4" aria-hidden />
            </MealRecordAction>
          ) : (
            <ul className="divide-y overflow-hidden rounded-input border bg-surface">
              {MEAL_TYPES.flatMap(({ value, label }) => {
                const entry = entries.find((item) => item.type === value)
                return entry
                  ? [
                      <li key={entry.id}>
                        <Link
                          to={`/meals/week?date=${today}&record=${entry.id}`}
                          className="flex min-h-12 min-w-0 items-center gap-2.5 px-3 py-2 text-sm outline-none hover:bg-cream-hover focus-visible:bg-cream-hover"
                        >
                          <span className="shrink-0 text-[15px] font-bold">{label}</span>
                          <span className="min-w-0 flex-1 break-words">
                            {[...entry.foods, ...entry.recipes].map((item) => item.name).join(', ')}
                          </span>
                          {entry.eaten ? (
                            <Badge variant="tried">먹음</Badge>
                          ) : (
                            <Badge variant="soft">예정</Badge>
                          )}
                        </Link>
                      </li>,
                    ]
                  : []
              })}
            </ul>
          )
        }
      </QueryContent>
    </Card>
  )
}
