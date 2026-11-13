import { useId, type ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import type { LucideIcon } from 'lucide-react'
import { ChevronRight, MessageCircle, Moon, Ruler, Sparkles, Utensils, Check } from 'lucide-react'
import { Link } from 'react-router'
import { ErrorBanner } from '@/components/ErrorBanner'
import { ListLoading } from '@/components/ListLoading'
import { Page } from '@/components/Page'
import { Badge } from '@/components/ui/badge'
import { ageLabel } from '@/domain/age'
import { formatDateLabel, todayString, yesterdayString } from '@/domain/date'
import { formatNapSleep, formatNightSleep, formatTotalSleep } from '@/domain/sleep'
import type { BodyMeasure } from '@/lib/bodyApi'
import { formatMeasureValue } from '@/lib/bodyFormat'
import { NETWORK_ERROR_MESSAGES } from '@/lib/messages'
import type { Milestone } from '@/lib/milestoneApi'
import { milestoneTypeInfo } from '@/lib/milestoneTypes'
import type { SleepLog } from '@/lib/sleepApi'
import { summarizeSleepLog } from '@/lib/sleepSummary'
import { useBodyMeasures } from '@/lib/useBodyMeasures'
import { useChild } from '@/lib/useChild'
import { useMilestones } from '@/lib/useMilestones'
import { useMealDay } from '@/lib/useMeals'
import { MEAL_TYPES } from '@/lib/mealTypes'
import type { MealEntry } from '@/lib/mealApi'
import { useSleepLogs } from '@/lib/useSleepLogs'
import { cn } from '@/lib/utils'

/** 빠른 기록 (FR-HOME-05, R4). 가장 자주 쓰는 단어만 진한 보라 (docs/디자인.md 8장). 식단은 오늘 날짜의 주간 카드로 연결한다 */
const QUICK_RECORDS: { to: string; label: string; icon: LucideIcon; primary?: boolean }[] = [
  { to: '/milestones/new?type=word', label: '단어', icon: MessageCircle, primary: true },
  // 행동·표정은 유형을 고르지 않은 채 연다 (FR-MS-01)
  { to: '/milestones/new', label: '행동·표정', icon: Sparkles },
  { to: '/sleep/new', label: '수면', icon: Moon },
  { to: '/growth/body?record=new', label: '키·몸무게', icon: Ruler },
]

/**
 * 홈 (SCR-03, FR-HOME-01~06): 아이 이름·생후 일수·오늘 날짜, 오늘의 기록, 어젯밤 수면, 최근 측정, 빠른 기록.
 * 모바일은 한 열(수면·측정은 두 칸), PC는 오늘의 기록 옆에 수면·측정을 세로로 둔다 (시안 D-03)
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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
        <TodayCard query={milestones} today={today} className="col-span-2 md:row-span-2" />
        <SleepCard query={sleepLogs} yesterday={yesterdayString()} />
        <MeasureCard query={measures} />
      </div>

      <MealCard query={meals} today={today} />
      <QuickRecords today={today} />
    </Page>
  )
}

/** 카드 틀: 제목(아이콘) + 내용 */
function Card({
  title,
  icon: Icon,
  className,
  children,
}: {
  title: string
  icon?: LucideIcon
  className?: string
  children: ReactNode
}) {
  const id = useId()
  return (
    <section
      aria-labelledby={id}
      className={cn(
        'flex min-w-0 flex-col gap-3 rounded-card border bg-surface p-4 md:p-5',
        className,
      )}
    >
      <h2
        id={id}
        className={cn(
          'flex items-center gap-1.5',
          Icon ? 'text-sm font-bold text-soft-text' : 'text-[17px] font-bold md:text-lg',
        )}
      >
        {Icon && <Icon className="size-4.5 shrink-0" aria-hidden />}
        {title}
      </h2>
      {children}
    </section>
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

/** 0건일 때 입력 화면으로 가는 글자 버튼 (시안: "어젯밤 수면 기록하기 ›") */
function CardAction({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="flex min-h-11 items-center gap-0.5 self-start text-sm font-bold text-soft-text outline-none hover:underline focus-visible:underline"
    >
      {children}
      <ChevronRight className="size-4" aria-hidden />
    </Link>
  )
}

/**
 * 이름(흐린 글자) + 값(진한 글자). 값이 시간이 아니면("없음", "계산 불가") 흐리게.
 * stacked면 이름을 값 위에 둔다 (큰 글자로 보여 주는 대표 값)
 */
function LabeledValue({
  label,
  value,
  muted = false,
  stacked = false,
  className,
}: {
  label: string
  value: string
  muted?: boolean
  stacked?: boolean
  className?: string
}) {
  return (
    <div className={stacked ? 'flex flex-col' : 'flex flex-wrap items-baseline gap-x-1.5'}>
      <dt className="text-[13px] text-muted-foreground md:text-sm">{label}</dt>
      <dd
        className={cn('whitespace-nowrap', className, muted && 'font-normal text-muted-foreground')}
      >
        {value}
      </dd>
    </div>
  )
}

/**
 * 오늘의 기록 (FR-HOME-02, 06): 기록 날짜가 오늘인 발달 기록. 입력한 시각이 아니라 기록 날짜 기준이다.
 * 누르면 그 기록의 수정 화면이 열린다 (FR-COM-30)
 */
function TodayCard({
  query,
  today,
  className,
}: {
  query: UseQueryResult<Milestone[]>
  today: string
  className?: string
}) {
  return (
    <Card title="오늘의 기록" className={className}>
      <QueryContent query={query}>
        {(milestones) => {
          const records = milestones.filter((record) => record.date === today)
          if (records.length === 0) {
            return <p className="text-[15px] text-muted-foreground">오늘 첫 기록을 남겨 보세요</p>
          }
          return (
            <ul className="flex flex-col gap-2">
              {records.map((record) => (
                <li key={record.id}>
                  <Link
                    to={`/milestones/${record.id}`}
                    className="flex min-h-12 items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-colors outline-none hover:bg-muted focus-visible:bg-muted"
                  >
                    <Badge variant={record.type}>{milestoneTypeInfo(record.type).label}</Badge>
                    <span className="min-w-0 flex-1 truncate font-medium">{record.title}</span>
                    {record.memo && (
                      <span className="hidden max-w-[50%] truncate text-[13px] text-muted-foreground md:block">
                        {record.memo}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
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
  return (
    <Card title="어젯밤 수면" icon={Moon}>
      <QueryContent query={query}>
        {(logs) => {
          const log = logs.find((item) => item.date === yesterday)
          if (!log) return <CardAction to="/sleep/new">어젯밤 수면 기록하기</CardAction>
          const result = summarizeSleepLog(log)
          const total = result ? result.totalMinutes : null
          return (
            <dl className="flex flex-col gap-1">
              <LabeledValue
                label="총 수면"
                value={formatTotalSleep(total)}
                muted={total === null}
                stacked
                className="text-xl font-bold md:text-[22px]"
              />
              <LabeledValue
                label="밤잠"
                value={result ? formatNightSleep(result) : '계산 불가'}
                muted={result?.nightMinutes == null}
                className="text-[13px] font-medium md:text-sm"
              />
              <LabeledValue
                label="낮잠"
                value={result ? formatNapSleep(result) : '계산 불가'}
                muted={!result || result.naps.length === 0}
                className="text-[13px] font-medium md:text-sm"
              />
            </dl>
          )
        }}
      </QueryContent>
    </Card>
  )
}

/** 최근 측정 (FR-HOME-04): 가장 최근 키·몸무게와 측정 날짜. 한쪽만 있으면 빈 값은 "-" (FR-BODY-05) */
function MeasureCard({ query }: { query: UseQueryResult<BodyMeasure[]> }) {
  return (
    <Card title="최근 측정" icon={Ruler}>
      <QueryContent query={query}>
        {(measures) => {
          // 측정 날짜 최신순으로 받는다
          const latest = measures[0]
          if (!latest)
            return <CardAction to="/growth/body?record=new">키·몸무게 기록하기</CardAction>
          return (
            <>
              <dl className="flex flex-col gap-1">
                <LabeledValue
                  label="키"
                  value={formatMeasureValue(latest.heightCm, 'cm')}
                  muted={latest.heightCm === null}
                  className="text-lg font-bold md:text-xl"
                />
                <LabeledValue
                  label="몸무게"
                  value={formatMeasureValue(latest.weightKg, 'kg')}
                  muted={latest.weightKg === null}
                  className="text-lg font-bold md:text-xl"
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

/** 빠른 기록 버튼 (FR-HOME-05). 누르면 해당 입력 화면이 열리고, 저장·취소하면 홈으로 돌아온다 */
function QuickRecords({ today }: { today: string }) {
  const records = [
    QUICK_RECORDS[0],
    { to: `/meals/week?date=${today}`, label: '식단', icon: Utensils },
    ...QUICK_RECORDS.slice(1),
  ]
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2.5 md:gap-3">
      <h2 id={id} className="text-[17px] font-bold md:text-lg">
        빠른 기록
      </h2>
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-5 md:gap-3">
        {records.map(({ to, label, icon: Icon, primary }) => (
          <Link
            key={label}
            to={to}
            className={cn(
              'flex h-20 flex-col items-center justify-center gap-1.5 rounded-card text-sm font-bold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40 md:h-16 md:flex-row md:gap-2 md:text-base',
              primary
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-soft text-soft-text hover:bg-soft/70',
            )}
          >
            <Icon className="size-6 md:size-5.5" aria-hidden />
            {label}
          </Link>
        ))}
      </div>
    </section>
  )
}

/** 계획과 먹은 기록을 모두 표시하며 누르면 그 식단의 수정 시트를 연다. */
function MealCard({ query, today }: { query: UseQueryResult<MealEntry[]>; today: string }) {
  return (
    <Card title="오늘의 식단" icon={Utensils}>
      <QueryContent query={query}>
        {(entries) =>
          entries.length === 0 ? (
            <CardAction to={`/meals/week?date=${today}`}>오늘 식단 기록하기</CardAction>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {MEAL_TYPES.flatMap(({ value, label }) => {
                const entry = entries.find((item) => item.type === value)
                return entry
                  ? [
                      <li key={entry.id}>
                        <Link
                          to={`/meals/week?date=${today}&record=${entry.id}`}
                          className="flex min-h-16 min-w-0 items-center gap-3 rounded-input border px-3 py-3 outline-none hover:bg-soft focus-visible:bg-soft"
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
