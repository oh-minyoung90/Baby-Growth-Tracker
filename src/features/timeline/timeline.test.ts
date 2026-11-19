import { describe, expect, it } from 'vitest'
import type { Food } from '@/lib/foodApi'
import type { Milestone } from '@/lib/milestoneApi'
import {
  DEFAULT_FILTER,
  buildTimeline,
  countTimelineRecords,
  filterTimeline,
  filterToParams,
  groupByMonth,
  isInvalidRange,
  newMilestonePath,
  parseFilter,
  periodRange,
  toggleCountType,
  type TimelineFilter,
} from './timeline'

const TODAY = '2026-10-22'
const milestones: Milestone[] = [
  { id: 'w2', type: 'word', date: '2026-10-19', title: '네', memo: null },
  { id: 'e1', type: 'expression', date: '2026-10-03', title: '소리 내어 웃기', memo: '까꿍놀이' },
  { id: 'bh1', type: 'behavior', date: '2026-09-30', title: '까꿍놀이', memo: null },
  { id: 'w1', type: 'word', date: '2026-09-02', title: '엄마', memo: null },
]
const foods: Pick<Food, 'id' | 'name' | 'firstTriedDate'>[] = [
  { id: 'known', name: '브로콜리', firstTriedDate: '2026-09-30' },
  { id: 'unknown', name: '날짜 모름', firstTriedDate: null },
]
const keys = (items: { key: string }[]) => items.map((item) => item.key)
const filter = (patch: Partial<TimelineFilter>): TimelineFilter => ({ ...DEFAULT_FILTER, ...patch })

describe('기록 목록', () => {
  it('발달·음식을 최신순으로 합치고 같은 날짜에는 발달을 먼저 표시한다', () => {
    expect(keys(buildTimeline(milestones, foods))).toEqual([
      'milestone-w2',
      'milestone-e1',
      'milestone-bh1',
      'food-known',
      'milestone-w1',
    ])
  })
  it('발달은 수정, 음식은 상세로 연결하고 첫 날짜를 모르는 음식은 제외한다', () => {
    const items = buildTimeline(milestones, foods)
    expect(items[0].to).toBe('/milestones/w2')
    expect(items[3]).toMatchObject({ type: 'food', title: '브로콜리', to: '/meals/foods/known' })
    expect(buildTimeline([], foods)).toHaveLength(1)
    expect(buildTimeline([])).toEqual([])
  })
  it('날짜순 목록을 월별로 묶는다', () => {
    expect(
      groupByMonth(buildTimeline(milestones, foods)).map((group) => [
        group.label,
        group.items.length,
      ]),
    ).toEqual([
      ['2026년 10월', 2],
      ['2026년 9월', 3],
    ])
    expect(groupByMonth([])).toEqual([])
  })
})

describe('유형·기간 필터', () => {
  const items = buildTimeline(milestones, foods)
  it('기본은 전체, 카드는 한 유형만 보여준다', () => {
    expect(filterTimeline(items, DEFAULT_FILTER, TODAY)).toHaveLength(5)
    expect(keys(filterTimeline(items, filter({ type: 'word' }), TODAY))).toEqual([
      'milestone-w2',
      'milestone-w1',
    ])
    expect(keys(filterTimeline(items, filter({ type: 'food' }), TODAY))).toEqual(['food-known'])
  })
  it('이번 달·지난 달과 유형을 함께 적용한다', () => {
    expect(keys(filterTimeline(items, filter({ period: 'this' }), TODAY))).toEqual([
      'milestone-w2',
      'milestone-e1',
    ])
    expect(keys(filterTimeline(items, filter({ period: 'last' }), TODAY))).toEqual([
      'milestone-bh1',
      'food-known',
      'milestone-w1',
    ])
    expect(keys(filterTimeline(items, filter({ type: 'word', period: 'last' }), TODAY))).toEqual([
      'milestone-w1',
    ])
  })
  it('직접 지정한 날짜 양 끝을 포함하고, 비어 있는 쪽은 제한하지 않는다', () => {
    const custom = (from: string, to: string) =>
      keys(filterTimeline(items, filter({ period: 'custom', from, to }), TODAY))
    expect(custom('2026-09-02', '2026-09-30')).toEqual([
      'milestone-bh1',
      'food-known',
      'milestone-w1',
    ])
    expect(custom('2026-10-01', '')).toEqual(['milestone-w2', 'milestone-e1'])
    expect(custom('', '2026-08-31')).toEqual([])
  })
  it('1월의 지난 달은 작년 12월이다', () => {
    expect(periodRange(filter({ period: 'last' }), '2027-01-05')).toEqual({
      from: '2026-12-01',
      to: '2026-12-31',
    })
  })
  it('직접 지정한 시작일이 종료일보다 늦으면 잘못된 범위다', () => {
    expect(isInvalidRange(filter({ period: 'custom', from: '2026-10-02', to: '2026-10-01' }))).toBe(
      true,
    )
    expect(isInvalidRange(filter({ period: 'custom', from: '2026-10-01', to: '2026-10-01' }))).toBe(
      false,
    )
    expect(isInvalidRange(filter({ period: 'custom', from: '2026-10-02', to: '' }))).toBe(false)
  })
})

describe('누적 카드와 기록 추가', () => {
  it('발달은 같은 내용을 하나로 세고, 음식은 첫 날짜가 있는 음식만 센다', () => {
    const legacyDuplicate = [...milestones, { ...milestones[2], id: 'bh2', title: ' 까꿍놀이 ' }]
    expect(countTimelineRecords(legacyDuplicate, foods)).toEqual({
      word: 2,
      behavior: 1,
      expression: 1,
      food: 1,
    })
    expect(countTimelineRecords([])).toEqual({ word: 0, behavior: 0, expression: 0, food: 0 })
  })
  it('카드 선택·재선택은 기간과 직접 지정한 날짜를 유지한다', () => {
    const custom = filter({ period: 'custom', from: '2026-10-01', to: '2026-10-22' })
    const word = toggleCountType(custom, 'word')
    expect(word).toEqual({ ...custom, type: 'word' })
    expect(toggleCountType(word, 'word')).toEqual(custom)
    expect(toggleCountType(word, 'food')).toEqual({ ...custom, type: 'food' })
  })
  it('발달 유형을 선택한 경우에만 그 유형의 입력을 연다', () => {
    expect(newMilestonePath(filter({ type: 'behavior' }))).toBe('/milestones/new?type=behavior')
    expect(newMilestonePath(filter({ type: 'food' }))).toBe('/milestones/new')
    expect(newMilestonePath(DEFAULT_FILTER)).toBe('/milestones/new')
  })
})

describe('공유 주소와 이전 필터 주소', () => {
  it('기본은 주소에 남기지 않고 단일 유형·기간은 왕복할 수 있다', () => {
    expect(filterToParams(DEFAULT_FILTER)).toEqual({})
    expect(parseFilter(new URLSearchParams())).toEqual(DEFAULT_FILTER)
    const custom = filter({ type: 'food', period: 'custom', from: '2026-09-01', to: '2026-09-30' })
    const params = filterToParams(custom)
    expect(params).toEqual({
      types: 'food',
      period: 'custom',
      from: '2026-09-01',
      to: '2026-09-30',
    })
    expect(parseFilter(new URLSearchParams(params))).toEqual(custom)
  })
  it.each(['measure', 'word,expression', '', 'unknown'])(
    '이전 types=%s 주소는 기간을 유지하며 전체 유형으로 해석한다',
    (types) => {
      expect(parseFilter(new URLSearchParams({ types, period: 'last' }))).toEqual(
        filter({ period: 'last' }),
      )
    },
  )
  it('측정·모르는 값과 함께 온 지원 유형 하나는 그대로 사용한다', () => {
    expect(parseFilter(new URLSearchParams('types=expression,measure&period=this'))).toEqual(
      filter({ type: 'expression', period: 'this' }),
    )
    expect(parseFilter(new URLSearchParams('types=food,unknown&period=year'))).toEqual(
      filter({ type: 'food' }),
    )
  })
})
