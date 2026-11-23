import { useRef, useState, type ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import type { LucideIcon } from 'lucide-react'
import { ChevronRight, Moon, Ruler, Utensils, Check, NotebookPen, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { ErrorBanner } from '@/components/ErrorBanner'
import { ListLoading } from '@/components/ListLoading'
import { Page } from '@/components/Page'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { ageLabel } from '@/domain/age'
import { formatDateLabel, todayString, yesterdayString } from '@/domain/date'
import { formatNapSleep, formatNightSleep, formatTotalSleep } from '@/domain/sleep'
import type { BodyMeasure } from '@/lib/bodyApi'
import { formatMeasureValue } from '@/lib/bodyFormat'
import { NETWORK_ERROR_MESSAGES } from '@/lib/messages'
import type { Milestone } from '@/lib/milestoneApi'
import { MILESTONE_TYPES, milestoneTypeInfo } from '@/lib/milestoneTypes'
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
  'inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-button px-2 text-sm font-bold text-soft-text outline-none hover:bg-soft focus-visible:ring-3 focus-visible:ring-ring/40'

/**
 * 홈 (SCR-03): 쇼핑 → 식단 → 오늘 기록 → 어젯밤 수면 → 최근 측정.
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
      heading={
        child && (
          <>
            {child.nickname}
            {age && <span className="text-soft-text"> · {age}</span>}
          </>
        )
      }
      description={formatDateLabel(today)}
    >
      {failed.length > 0 && (
        <ErrorBanner
          message={NETWORK_ERROR_MESSAGES.load}
          onRetry={() => failed.forEach((query) => void query.refetch())}
          retrying={failed.some((query) => query.isFetching)}
        />
      )}

      <ShoppingCard />
      <MealCard query={meals} today={today} />
      <TodayCard query={milestones} today={today} />
      <SleepCard query={sleepLogs} yesterday={yesterdayString()} />
      <MeasureCard query={measures} />
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
 * 이름(흐린 글자) + 값(진한 글자). 값이 시간이 아니면("없음", "계산 불가") 흐리게.
 */
function LabeledValue({
  label,
  value,
  muted = false,
  className,
}: {
  label: string
  value: string
  muted?: boolean
  className?: string
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('font-bold', className, muted && 'font-normal text-muted-foreground')}>
        {value}
      </dd>
    </div>
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
      icon={NotebookPen}
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
          return (
            <ul className="flex flex-col gap-2">
              {records.map((record) => {
                const { icon: Icon, label } = milestoneTypeInfo(record.type)
                return (
                  <li key={record.id}>
                    <Link
                      to={`/milestones/${record.id}`}
                      className="flex min-h-11 items-start gap-2.5 rounded-input py-1.5 outline-none hover:bg-muted focus-visible:bg-muted"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-soft text-soft-text">
                        <Icon className="size-4.5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="sr-only">{label}</span>
                        <span className="block text-[15px] font-medium break-words">
                          {record.title}
                        </span>
                        {record.memo && (
                          <span className="mt-0.5 line-clamp-2 text-[13px] break-words text-muted-foreground">
                            {record.memo}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )
        }}
      </QueryContent>
    </Card>
  )
}

/**
 * 어젯밤 수면 (FR-HOME-03): 수면일이 어제인 기록의 총 수면과 밤잠·낮잠.
 * 잠든·일어난 시간 중 하나만 있으면 총 수면은 "계산 불가" (BR-07, R44)
 */
function SleepCard({ query, yesterday }: { query: UseQueryResult<SleepLog[]>; yesterday: string }) {
  const existing = query.isSuccess ? query.data.find((log) => log.date === yesterday) : undefined
  return (
    <Card
      title="어젯밤 수면"
      icon={Moon}
      action={
        existing && (
          <Link
            to={`/sleep/${existing.id}`}
            className={HEADER_ACTION_CLASS}
            aria-label="어젯밤 수면 수정"
          >
            수정
          </Link>
        )
      }
    >
      <QueryContent query={query}>
        {(logs) => {
          const log = logs.find((item) => item.date === yesterday)
          if (!log) return <CardAction to="/sleep/new">어젯밤 수면 기록하기</CardAction>
          const result = summarizeSleepLog(log)
          const total = result ? result.totalMinutes : null
          return (
            <div className="flex flex-col gap-1">
              <dl>
                <LabeledValue label="총" value={formatTotalSleep(total)} muted={total === null} />
              </dl>
              <dl className="flex flex-wrap gap-x-4 gap-y-1">
                <LabeledValue
                  label="밤잠"
                  value={result ? formatNightSleep(result) : '계산 불가'}
                  muted={result?.nightMinutes == null}
                  className="text-[13px] font-normal text-muted-foreground"
                />
                <LabeledValue
                  label="낮잠"
                  value={result ? formatNapSleep(result) : '계산 불가'}
                  muted={!result || result.naps.length === 0}
                  className="text-[13px] font-normal text-muted-foreground"
                />
              </dl>
            </div>
          )
        }}
      </QueryContent>
    </Card>
  )
}

/** 최근 측정 (FR-HOME-04): 가장 최근 키·몸무게와 측정 날짜. 한쪽만 있으면 빈 값은 "-" (FR-BODY-05) */
function MeasureCard({ query }: { query: UseQueryResult<BodyMeasure[]> }) {
  const hasRecords = query.isSuccess && query.data.length > 0
  return (
    <Card
      title="최근 측정"
      icon={Ruler}
      action={
        hasRecords && (
          <Link
            to="/growth/body?record=new"
            className={HEADER_ACTION_CLASS}
            aria-label="키·몸무게 기록 추가"
          >
            <Plus className="size-4" aria-hidden />
            기록
          </Link>
        )
      }
    >
      <QueryContent query={query}>
        {(measures) => {
          // 측정 날짜 최신순으로 받는다
          const latest = measures[0]
          if (!latest)
            return <CardAction to="/growth/body?record=new">키·몸무게 기록하기</CardAction>
          return (
            <>
              <dl className="flex flex-wrap gap-x-5 gap-y-2">
                <LabeledValue
                  label="키"
                  value={formatMeasureValue(latest.heightCm, 'cm')}
                  muted={latest.heightCm === null}
                />
                <LabeledValue
                  label="몸무게"
                  value={formatMeasureValue(latest.weightKg, 'kg')}
                  muted={latest.weightKg === null}
                />
              </dl>
              {/* 좁은 화면에서는 날짜 중간이나 "측·정" 사이가 아니라 날짜와 "측정" 사이에서 줄을 바꾼다 */}
              <p className="text-[13px] break-keep text-muted-foreground">
                <span className="whitespace-nowrap">{formatDateLabel(latest.date)}</span> 측정
              </p>
            </>
          )
        }}
      </QueryContent>
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
      icon={Utensils}
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
            <ul className="flex flex-col gap-2">
              {MEAL_TYPES.flatMap(({ value, label }) => {
                const entry = entries.find((item) => item.type === value)
                return entry
                  ? [
                      <li key={entry.id}>
                        <Link
                          to={`/meals/week?date=${today}&record=${entry.id}`}
                          className="flex min-h-16 min-w-0 items-center gap-3 rounded-input border bg-surface px-3 py-3 text-sm outline-none hover:bg-soft focus-visible:bg-soft"
                        >
                          <span className="shrink-0 text-sm font-bold">{label}</span>
                          <span className="min-w-0 flex-1 break-words">
                            {[...entry.foods, ...entry.recipes].map((item) => item.name).join(', ')}
                          </span>
                          {entry.eaten ? (
                            <Badge variant="tried">
                              <Check aria-hidden />
                              먹음
                            </Badge>
                          ) : (
                            <Badge variant="plan">계획</Badge>
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
