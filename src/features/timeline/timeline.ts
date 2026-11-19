import { format, subMonths } from 'date-fns'
import { Utensils, type LucideIcon } from 'lucide-react'
import { parseDate } from '@/domain/date'
import { countDistinctContent } from '@/domain/text'
import type { Food } from '@/lib/foodApi'
import type { Milestone } from '@/lib/milestoneApi'
import { MILESTONE_TYPE_VALUES, milestoneTypeInfo, type MilestoneType } from '@/lib/milestoneTypes'

/**
 * 타임라인 유형 (FR-TL-03, 06): 발달 유형 + 처음 먹은 음식. 측정은 키·몸무게 탭에서 별도로 본다.
 */
export type TimelineType = MilestoneType | 'food'

export const TIMELINE_TYPE_VALUES: readonly TimelineType[] = [...MILESTONE_TYPE_VALUES, 'food']

/** 유형 이름과 아이콘 (FR-TL-02). 발달 유형은 입력 화면과 같다 */
export function timelineTypeInfo(type: TimelineType): { label: string; icon: LucideIcon } {
  if (type === 'food') return { label: '처음 먹은 음식', icon: Utensils }
  return milestoneTypeInfo(type)
}

/** 유형 색 (docs/디자인.md 2.3). 색만으로 구분하지 않도록 이름을 함께 쓴다 */
export const TYPE_COLORS: Record<TimelineType, string> = {
  word: 'bg-type-word text-type-word-text',
  behavior: 'bg-type-behavior text-type-behavior-text',
  expression: 'bg-type-expression text-type-expression-text',
  food: 'bg-type-food-icon text-type-food-icon-text',
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
  /** 누르면 여는 화면. 음식은 상세로 연결하며 타임라인에서는 수정하지 않는다(FR-TL-06). 측정은 별도 탭 (FR-TL-07) */
  to: string
}

/** 기간 필터 (FR-TL-04) */
export type TimelinePeriod = 'all' | 'this' | 'last' | 'custom'

export const TIMELINE_PERIODS: { value: TimelinePeriod; label: string }[] = [
  { value: 'all', label: '전체 기간' },
  { value: 'this', label: '이번 달' },
  { value: 'last', label: '지난 달' },
  { value: 'custom', label: '직접 선택' },
]

export interface TimelineFilter {
  /** 한 유형 또는 전체(null). 기간과 독립적으로 선택한다. */
  type: TimelineType | null
  period: TimelinePeriod
  /** 직접 선택일 때의 시작일·종료일 'YYYY-MM-DD'. 비어 있으면 그쪽은 제한하지 않는다 */
  from: string
  to: string
}

export const DEFAULT_FILTER: TimelineFilter = {
  type: null,
  period: 'all',
  from: '',
  to: '',
}

/**
 * 발달 기록·처음 먹은 음식을 날짜 최신순으로 합친다 (FR-TL-01).
 * 같은 날짜에는 발달·음식 순서를 유지한다. 같은 날짜면 발달 기록이 먼저, 발달 기록끼리는 받은 순서(나중에 저장한 것이 먼저)를 지킨다.
 */
export function buildTimeline(
  milestones: readonly Milestone[],
  foods: readonly Pick<Food, 'id' | 'name' | 'firstTriedDate'>[] = [],
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
    ...foods.flatMap((food) =>
      food.firstTriedDate
        ? [
            {
              key: `food-${food.id}`,
              type: 'food' as const,
              date: food.firstTriedDate,
              title: food.name,
              memo: null,
              to: `/meals/foods/${food.id}`,
            },
          ]
        : [],
    ),
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
      (filter.type === null || filter.type === item.type) &&
      (from === '' || item.date >= from) &&
      (to === '' || item.date <= to),
  )
}

/** 누적 개수. 발달은 같은 내용 1개, 음식은 첫 날짜가 있는 음식 1개로 센다. */
export function countTimelineRecords(
  milestones: readonly Milestone[],
  foods: readonly Pick<Food, 'firstTriedDate'>[] = [],
): Record<TimelineType, number> {
  const count = (type: MilestoneType) =>
    countDistinctContent(
      milestones.filter((record) => record.type === type).map((record) => record.title),
    )
  return {
    word: count('word'),
    behavior: count('behavior'),
    expression: count('expression'),
    food: foods.filter((food) => food.firstTriedDate).length,
  }
}

/** 같은 카드를 다시 누르면 전체 유형으로. 기간·직접 지정한 날짜는 유지한다. */
export function toggleCountType(filter: TimelineFilter, type: TimelineType): TimelineFilter {
  return { ...filter, type: filter.type === type ? null : type }
}

/** 선택한 발달 유형으로 입력한다. 전체·음식 보기에서는 유형을 고르지 않은 채 연다. */
export function newMilestonePath(filter: TimelineFilter): string {
  const type = MILESTONE_TYPE_VALUES.find((value) => value === filter.type)
  return type ? `/milestones/new?type=${type}` : '/milestones/new'
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
 * ?types=word&period=custom&from=…&to=… 형식을 유지한다.
 * 기존 여러 유형·측정 전용·빈 필터 주소는 지원하는 단일 유형 또는 전체로 해석한다.
 */
export function parseFilter(params: URLSearchParams): TimelineFilter {
  const types = params.get('types')?.split(',') ?? []
  const recognized = TIMELINE_TYPE_VALUES.filter((type) => types.includes(type))
  const period = TIMELINE_PERIODS.find((option) => option.value === params.get('period'))?.value
  return {
    type: recognized.length === 1 ? recognized[0] : null,
    period: period ?? 'all',
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
  }
}

export function filterToParams(filter: TimelineFilter): Record<string, string> {
  const params: Record<string, string> = {}
  if (filter.type !== null) params.types = filter.type
  if (filter.period !== 'all') params.period = filter.period
  if (filter.period === 'custom') {
    if (filter.from) params.from = filter.from
    if (filter.to) params.to = filter.to
  }
  return params
}
