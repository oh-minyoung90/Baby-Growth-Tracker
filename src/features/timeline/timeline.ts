import { format, subMonths } from 'date-fns'
import { Ruler, type LucideIcon } from 'lucide-react'
import { parseDate } from '@/domain/date'
import type { BodyMeasure } from '@/lib/bodyApi'
import { formatMeasureValue } from '@/lib/bodyFormat'
import type { Milestone } from '@/lib/milestoneApi'
import { MILESTONE_TYPE_VALUES, milestoneTypeInfo, type MilestoneType } from '@/lib/milestoneTypes'

/**
 * 타임라인 유형 (FR-TL-03): 발달 4유형 + 키·몸무게.
 * "처음 먹은 음식"(FR-TL-06)은 음식 목록이 생기는 T-51에서 추가한다.
 */
export type TimelineType = MilestoneType | 'measure'

export const TIMELINE_TYPE_VALUES: readonly TimelineType[] = [...MILESTONE_TYPE_VALUES, 'measure']

/** 유형 이름과 아이콘 (FR-TL-02). 발달 4유형은 입력 화면과 같다 */
export function timelineTypeInfo(type: TimelineType): { label: string; icon: LucideIcon } {
  return type === 'measure' ? { label: '키·몸무게', icon: Ruler } : milestoneTypeInfo(type)
}

/** 타임라인 한 줄 (FR-TL-02) */
export interface TimelineItem {
  /** 목록 key. 발달 기록과 측정의 id가 겹치지 않게 앞에 종류를 붙인다 */
  key: string
  type: TimelineType
  /** 'YYYY-MM-DD' */
  date: string
  title: string
  memo: string | null
  /** 누르면 여는 수정 화면 (FR-COM-30). 측정은 키·몸무게 화면의 수정 시트 (FR-TL-07) */
  to: string
}

/** 기간 필터 (FR-TL-04) */
export type TimelinePeriod = 'all' | 'this' | 'last' | 'custom'

export const TIMELINE_PERIODS: { value: TimelinePeriod; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'this', label: '이번 달' },
  { value: 'last', label: '지난 달' },
  { value: 'custom', label: '직접 선택' },
]

export interface TimelineFilter {
  /** 보여 줄 유형. 기본은 전체 */
  types: readonly TimelineType[]
  period: TimelinePeriod
  /** 직접 선택일 때의 시작일·종료일 'YYYY-MM-DD'. 비어 있으면 그쪽은 제한하지 않는다 */
  from: string
  to: string
}

export const DEFAULT_FILTER: TimelineFilter = {
  types: TIMELINE_TYPE_VALUES,
  period: 'all',
  from: '',
  to: '',
}

/** 측정 내용: "72.1cm · 8.9kg". 한쪽만 있으면 그 값만 (FR-TL-07) */
export function measureSummary({ heightCm, weightKg }: BodyMeasure): string {
  return [
    heightCm !== null && formatMeasureValue(heightCm, 'cm'),
    weightKg !== null && formatMeasureValue(weightKg, 'kg'),
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * 발달 기록과 측정을 날짜 최신순으로 합친다 (FR-TL-01).
 * 두 목록은 이미 날짜 최신순이다. 같은 날짜면 발달 기록이 먼저, 발달 기록끼리는 받은 순서(나중에 저장한 것이 먼저)를 지킨다.
 */
export function buildTimeline(
  milestones: readonly Milestone[],
  measures: readonly BodyMeasure[],
): TimelineItem[] {
  const items: TimelineItem[] = [
    ...milestones.map((record) => ({
      key: `milestone-${record.id}`,
      type: record.type,
      date: record.date,
      title: record.title,
      memo: record.memo,
      to: `/milestones/${record.id}`,
    })),
    ...measures.map((measure) => ({
      key: `measure-${measure.id}`,
      type: 'measure' as const,
      date: measure.date,
      title: measureSummary(measure),
      memo: measure.memo,
      to: `/growth/body?record=${measure.id}`,
    })),
  ]
  // 정렬은 안정적이라 같은 날짜는 위 순서를 유지한다
  return items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

/** 'YYYY-MM-DD' → 'YYYY-MM' */
function monthKey(date: string): string {
  return date.slice(0, 7)
}

/** 기간 필터를 날짜 범위로 바꾼다. 양 끝 포함, 빈 문자열은 제한 없음 */
export function periodRange(
  { period, from, to }: Pick<TimelineFilter, 'period' | 'from' | 'to'>,
  today: string,
): { from: string; to: string } {
  switch (period) {
    case 'all':
      return { from: '', to: '' }
    case 'this':
      return monthRange(monthKey(today))
    case 'last':
      return monthRange(format(subMonths(parseDate(today), 1), 'yyyy-MM'))
    case 'custom':
      return { from, to }
  }
}

function monthRange(month: string) {
  // 문자열로 비교하므로 말일은 31로 둬도 된다
  return { from: `${month}-01`, to: `${month}-31` }
}

export const RANGE_ERROR = '종료일은 시작일 이후로 골라 주세요'

/** 직접 선택한 시작일이 종료일보다 늦은지 */
export function isInvalidRange({ period, from, to }: TimelineFilter): boolean {
  return period === 'custom' && from !== '' && to !== '' && from > to
}

/** 유형·기간 필터 적용 (FR-TL-03~04) */
export function filterTimeline(
  items: readonly TimelineItem[],
  filter: TimelineFilter,
  today: string,
): TimelineItem[] {
  const { from, to } = periodRange(filter, today)
  return items.filter(
    (item) =>
      filter.types.includes(item.type) &&
      (from === '' || item.date >= from) &&
      (to === '' || item.date <= to),
  )
}

/** 월 단위 묶음: "2026년 10월" (FR-TL-01). items는 날짜 최신순 */
export function groupByMonth(
  items: readonly TimelineItem[],
): { month: string; label: string; items: TimelineItem[] }[] {
  const groups: { month: string; label: string; items: TimelineItem[] }[] = []
  for (const item of items) {
    const month = monthKey(item.date)
    const last = groups.at(-1)
    if (last?.month === month) last.items.push(item)
    else {
      const [year, monthNumber] = month.split('-')
      groups.push({ month, label: `${year}년 ${Number(monthNumber)}월`, items: [item] })
    }
  }
  return groups
}

/**
 * 필터는 주소에 둔다: ?types=word,measure&period=custom&from=…&to=…
 * 수정 화면에 갔다 돌아와도 유지된다. 기본값(전체 유형, 전체 기간)이면 주소에 남기지 않는다.
 * types=(빈 값)은 유형을 모두 끈 상태다.
 */
export function parseFilter(params: URLSearchParams): TimelineFilter {
  const types = params.get('types')
  const period = TIMELINE_PERIODS.find((option) => option.value === params.get('period'))?.value
  return {
    types:
      types === null
        ? DEFAULT_FILTER.types
        : TIMELINE_TYPE_VALUES.filter((type) => types.split(',').includes(type)),
    period: period ?? 'all',
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
  }
}

export function filterToParams(filter: TimelineFilter): Record<string, string> {
  const params: Record<string, string> = {}
  if (filter.types.length !== TIMELINE_TYPE_VALUES.length) {
    // 순서는 화면의 유형 순서로 맞춘다
    params.types = TIMELINE_TYPE_VALUES.filter((type) => filter.types.includes(type)).join(',')
  }
  if (filter.period !== 'all') params.period = filter.period
  if (filter.period === 'custom') {
    if (filter.from) params.from = filter.from
    if (filter.to) params.to = filter.to
  }
  return params
}
