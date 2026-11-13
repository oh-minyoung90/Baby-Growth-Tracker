import { format, subMonths } from 'date-fns'
import { Ruler, Utensils, type LucideIcon } from 'lucide-react'
import { parseDate } from '@/domain/date'
import { countDistinctContent } from '@/domain/text'
import type { BodyMeasure } from '@/lib/bodyApi'
import { formatMeasureValue } from '@/lib/bodyFormat'
import type { Food } from '@/lib/foodApi'
import type { Milestone } from '@/lib/milestoneApi'
import { MILESTONE_TYPE_VALUES, milestoneTypeInfo, type MilestoneType } from '@/lib/milestoneTypes'

/**
 * 타임라인 유형 (FR-TL-03, 06): 발달 유형 + 키·몸무게 + 처음 먹은 음식.
 */
export type TimelineType = MilestoneType | 'measure' | 'food'

export const TIMELINE_TYPE_VALUES: readonly TimelineType[] = [
  ...MILESTONE_TYPE_VALUES,
  'measure',
  'food',
]

/** 유형 이름과 아이콘 (FR-TL-02). 발달 유형은 입력 화면과 같다 */
export function timelineTypeInfo(type: TimelineType): { label: string; icon: LucideIcon } {
  if (type === 'food') return { label: '처음 먹은 음식', icon: Utensils }
  return type === 'measure' ? { label: '키·몸무게', icon: Ruler } : milestoneTypeInfo(type)
}

/** 유형 색 (docs/디자인.md 2.3). 색만으로 구분하지 않도록 이름을 함께 쓴다 */
export const TYPE_COLORS: Record<TimelineType, string> = {
  word: 'bg-type-word text-type-word-text',
  behavior: 'bg-type-behavior text-type-behavior-text',
  expression: 'bg-type-expression text-type-expression-text',
  measure: 'bg-type-measure text-type-measure-text',
  food: 'bg-type-food text-type-food-text',
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
  /** 누르면 여는 화면. 음식은 상세로 연결하며 타임라인에서는 수정하지 않는다(FR-TL-06). 측정은 키·몸무게 화면의 수정 시트 (FR-TL-07) */
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
 * 발달 기록·측정·처음 먹은 음식을 날짜 최신순으로 합친다 (FR-TL-01).
 * 같은 날짜에는 발달·측정·음식 순서를 유지한다. 같은 날짜면 발달 기록이 먼저, 발달 기록끼리는 받은 순서(나중에 저장한 것이 먼저)를 지킨다.
 */
export function buildTimeline(
  milestones: readonly Milestone[],
  measures: readonly BodyMeasure[],
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
    ...measures.map((measure) => ({
      key: `measure-${measure.id}`,
      type: 'measure' as const,
      date: measure.date,
      title: measureSummary(measure),
      memo: measure.memo,
      to: `/growth/body?record=${measure.id}`,
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
      filter.types.includes(item.type) &&
      (from === '' || item.date >= from) &&
      (to === '' || item.date <= to),
  )
}

/** 유형별 개수 (FR-TL-08). 필터와 관계없이 전체 기록 기준이며, 같은 내용(BR-03)은 1개로 센다 (R28) */
export function countMilestones(milestones: readonly Milestone[]): Record<MilestoneType, number> {
  const count = (type: MilestoneType) =>
    countDistinctContent(
      milestones.filter((record) => record.type === type).map((record) => record.title),
    )
  return { word: count('word'), behavior: count('behavior'), expression: count('expression') }
}

/** 개수 칸으로 고른 유형 (FR-TL-09): 유형 필터가 발달 유형 하나뿐이고 기간이 전체일 때 */
export function selectedCountType(filter: TimelineFilter): MilestoneType | null {
  if (filter.types.length !== 1 || filter.period !== 'all') return null
  return MILESTONE_TYPE_VALUES.find((type) => filter.types.includes(type)) ?? null
}

/** 개수 칸을 눌렀을 때의 필터 (FR-TL-09): 그 유형만, 기간은 전체. 이미 그 유형만 보고 있으면 초기화 */
export function toggleCountType(filter: TimelineFilter, type: MilestoneType): TimelineFilter {
  return selectedCountType(filter) === type ? DEFAULT_FILTER : { ...DEFAULT_FILTER, types: [type] }
}

/** 추가 버튼으로 여는 입력 화면 (FR-TL-10). 발달 유형이 하나만 켜져 있으면 그 유형을 고른 채 연다 */
export function newMilestonePath(filter: TimelineFilter): string {
  const [only, ...rest] = MILESTONE_TYPE_VALUES.filter((type) => filter.types.includes(type))
  return only && rest.length === 0 ? `/milestones/new?type=${only}` : '/milestones/new'
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
