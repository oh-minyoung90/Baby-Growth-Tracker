import { describe, expect, it } from 'vitest'
import type { BodyMeasure } from '@/lib/bodyApi'
import type { Milestone } from '@/lib/milestoneApi'
import {
  DEFAULT_FILTER,
  buildTimeline,
  countMilestones,
  filterTimeline,
  filterToParams,
  groupByMonth,
  isInvalidRange,
  measureSummary,
  newMilestonePath,
  parseFilter,
  periodRange,
  selectedCountType,
  toggleCountType,
  type TimelineFilter,
} from './timeline'

// 타임라인 (FR-TL-01~05, 07~10). 기록은 가명 예시, 오늘은 2026-10-22

const TODAY = '2026-10-22'

const milestones: Milestone[] = [
  { id: 'w2', type: 'word', date: '2026-10-19', title: '네', memo: null },
  { id: 'e1', type: 'expression', date: '2026-10-03', title: '소리 내어 웃기', memo: '까꿍놀이' },
  { id: 'bh1', type: 'behavior', date: '2026-09-30', title: '까꿍놀이', memo: null },
  { id: 'w1', type: 'word', date: '2026-09-02', title: '엄마', memo: null },
]
const measures: BodyMeasure[] = [
  { id: 'b2', date: '2026-09-30', heightCm: 72.1, weightKg: 8.9, memo: '영유아 검진' },
  { id: 'b1', date: '2026-08-31', heightCm: 70.2, weightKg: null, memo: null },
]

const keys = (items: { key: string }[]) => items.map((item) => item.key)
const filter = (patch: Partial<TimelineFilter>): TimelineFilter => ({ ...DEFAULT_FILTER, ...patch })

describe('buildTimeline', () => {
  it('발달 기록과 측정을 날짜 최신순으로 합치고, 같은 날짜면 발달 기록이 먼저다', () => {
    expect(keys(buildTimeline(milestones, measures))).toEqual([
      'milestone-w2',
      'milestone-e1',
      'milestone-bh1',
      'measure-b2',
      'milestone-w1',
      'measure-b1',
    ])
  })

  it('측정은 "72.1cm · 8.9kg"로 보여 주고, 누르면 키·몸무게 수정 시트를 연다 (FR-TL-07)', () => {
    const [, , , measure] = buildTimeline(milestones, measures)
    expect(measure).toMatchObject({
      type: 'measure',
      title: '72.1cm · 8.9kg',
      memo: '영유아 검진',
      to: '/growth/body?record=b2',
    })
    expect(buildTimeline([], measures)[0].to).toBe('/growth/body?record=b2')
    expect(buildTimeline(milestones, [])[0].to).toBe('/milestones/w2')
  })

  it('한쪽 값만 있으면 그 값만 보여 준다', () => {
    expect(measureSummary(measures[1])).toBe('70.2cm')
    expect(measureSummary({ ...measures[1], heightCm: null, weightKg: 9 })).toBe('9.0kg')
  })
})

describe('filterTimeline', () => {
  const items = buildTimeline(milestones, measures)

  it('기본값은 전체 유형·전체 기간이다', () => {
    expect(filterTimeline(items, DEFAULT_FILTER, TODAY)).toHaveLength(6)
  })

  it('고른 유형만 보여 준다 (FR-TL-03)', () => {
    expect(keys(filterTimeline(items, filter({ types: ['word', 'measure'] }), TODAY))).toEqual([
      'milestone-w2',
      'measure-b2',
      'milestone-w1',
      'measure-b1',
    ])
    expect(filterTimeline(items, filter({ types: [] }), TODAY)).toEqual([])
  })

  it('이번 달·지난 달 (FR-TL-04)', () => {
    expect(keys(filterTimeline(items, filter({ period: 'this' }), TODAY))).toEqual([
      'milestone-w2',
      'milestone-e1',
    ])
    expect(keys(filterTimeline(items, filter({ period: 'last' }), TODAY))).toEqual([
      'milestone-bh1',
      'measure-b2',
      'milestone-w1',
    ])
  })

  it('직접 선택은 시작일·종료일을 포함하고, 비어 있는 쪽은 제한하지 않는다', () => {
    const custom = (from: string, to: string) =>
      keys(filterTimeline(items, filter({ period: 'custom', from, to }), TODAY))
    expect(custom('2026-09-02', '2026-09-30')).toEqual([
      'milestone-bh1',
      'measure-b2',
      'milestone-w1',
    ])
    expect(custom('2026-10-01', '')).toEqual(['milestone-w2', 'milestone-e1'])
    expect(custom('', '2026-08-31')).toEqual(['measure-b1'])
  })

  it('유형과 기간을 함께 적용한다', () => {
    expect(keys(filterTimeline(items, filter({ types: ['word'], period: 'last' }), TODAY))).toEqual(
      ['milestone-w1'],
    )
  })
})

describe('periodRange', () => {
  it('1월의 지난 달은 작년 12월이다', () => {
    expect(periodRange(filter({ period: 'last' }), '2027-01-05')).toEqual({
      from: '2026-12-01',
      to: '2026-12-31',
    })
  })

  it('시작일이 종료일보다 늦으면 잘못된 범위다', () => {
    expect(isInvalidRange(filter({ period: 'custom', from: '2026-10-02', to: '2026-10-01' }))).toBe(
      true,
    )
    expect(isInvalidRange(filter({ period: 'custom', from: '2026-10-01', to: '2026-10-01' }))).toBe(
      false,
    )
    expect(isInvalidRange(filter({ period: 'custom', from: '2026-10-02', to: '' }))).toBe(false)
  })
})

describe('유형별 개수 (FR-TL-08~10)', () => {
  it('단어·행동·표정 개수를 세고, 같은 내용은 1개로 센다 (R28)', () => {
    expect(countMilestones(milestones)).toEqual({ word: 2, behavior: 1, expression: 1 })
    // 놀이를 행동으로 합치기 전에 저장한 같은 내용 (R42)
    const merged = [...milestones, { ...milestones[2], id: 'bh2', title: ' 까꿍놀이 ' }]
    expect(countMilestones(merged).behavior).toBe(1)
    expect(countMilestones([])).toEqual({ word: 0, behavior: 0, expression: 0 })
  })

  it('개수를 누르면 그 유형만 전체 기간으로 보고, 다시 누르면 초기화한다', () => {
    const custom = filter({ period: 'custom', from: '2026-10-01', to: '2026-10-22' })
    const wordOnly = toggleCountType(custom, 'word')
    expect(wordOnly).toEqual(filter({ types: ['word'] }))
    expect(selectedCountType(wordOnly)).toBe('word')
    expect(toggleCountType(wordOnly, 'word')).toEqual(DEFAULT_FILTER)
    expect(toggleCountType(wordOnly, 'expression')).toEqual(filter({ types: ['expression'] }))
  })

  it('한 유형만 보고 있어도 기간을 골랐거나 키·몸무게면 선택 표시하지 않는다', () => {
    expect(selectedCountType(DEFAULT_FILTER)).toBeNull()
    expect(selectedCountType(filter({ types: ['word'], period: 'this' }))).toBeNull()
    expect(selectedCountType(filter({ types: ['measure'] }))).toBeNull()
    expect(selectedCountType(filter({ types: ['word', 'measure'] }))).toBeNull()
  })

  it('추가 버튼은 발달 유형이 하나만 켜져 있으면 그 유형을 고른 채 연다', () => {
    expect(newMilestonePath(DEFAULT_FILTER)).toBe('/milestones/new')
    expect(newMilestonePath(filter({ types: ['behavior'] }))).toBe('/milestones/new?type=behavior')
    expect(newMilestonePath(filter({ types: ['word', 'measure'], period: 'last' }))).toBe(
      '/milestones/new?type=word',
    )
    expect(newMilestonePath(filter({ types: ['word', 'expression'] }))).toBe('/milestones/new')
    expect(newMilestonePath(filter({ types: [] }))).toBe('/milestones/new')
  })
})

describe('groupByMonth', () => {
  it('월마다 "2026년 10월" 제목으로 묶는다 (FR-TL-01)', () => {
    const groups = groupByMonth(buildTimeline(milestones, measures))
    expect(groups.map((group) => [group.label, group.items.length])).toEqual([
      ['2026년 10월', 2],
      ['2026년 9월', 3],
      ['2026년 8월', 1],
    ])
    expect(groupByMonth([])).toEqual([])
  })
})

describe('주소의 필터', () => {
  it('기본값은 주소에 남기지 않는다', () => {
    expect(filterToParams(DEFAULT_FILTER)).toEqual({})
    expect(parseFilter(new URLSearchParams())).toEqual(DEFAULT_FILTER)
  })

  it('주소로 바꿨다가 다시 읽으면 같은 필터다', () => {
    const custom = filter({
      types: ['measure', 'word'],
      period: 'custom',
      from: '2026-09-01',
      to: '2026-09-30',
    })
    const params = filterToParams(custom)
    expect(params).toEqual({
      types: 'word,measure',
      period: 'custom',
      from: '2026-09-01',
      to: '2026-09-30',
    })
    expect(parseFilter(new URLSearchParams(params))).toEqual({
      ...custom,
      types: ['word', 'measure'],
    })
  })

  it('유형을 모두 끄면 types가 빈 값이고, 모르는 값은 무시한다', () => {
    expect(filterToParams(filter({ types: [] }))).toEqual({ types: '' })
    expect(parseFilter(new URLSearchParams('types=&period=this'))).toMatchObject({
      types: [],
      period: 'this',
    })
    expect(parseFilter(new URLSearchParams('types=word,food&period=year'))).toMatchObject({
      types: ['word'],
      period: 'all',
    })
  })
})
