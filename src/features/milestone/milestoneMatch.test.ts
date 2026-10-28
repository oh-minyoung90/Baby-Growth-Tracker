import { describe, expect, it } from 'vitest'
import type { Milestone } from '@/lib/milestoneApi'
import { duplicateKey, findDuplicate, similarMilestones } from './milestoneMatch'

// 비슷한 기록·같은 내용 찾기 (F-07, FR-MS-05~06). 기록은 가명 예시, 날짜 최신순
const records: Milestone[] = [
  { id: 'w3', type: 'word', date: '2026-10-20', title: '엄마', memo: null },
  { id: 'b1', type: 'behavior', date: '2026-10-12', title: '잡고 서기', memo: null },
  { id: 'w2', type: 'word', date: '2026-09-02', title: '맘마', memo: null },
  { id: 'w1', type: 'word', date: '2026-08-15', title: 'Mam ma', memo: null },
]

const titles = (list: Milestone[]) => list.map((record) => record.title)

describe('similarMilestones (FR-MS-05)', () => {
  it('같은 유형에서 입력한 글자를 포함하는 기록만 최신순으로 고른다', () => {
    expect(titles(similarMilestones(records, { type: 'word', title: '마' }))).toEqual([
      '엄마',
      '맘마',
    ])
  })

  it('공백·대소문자를 무시하고 포함 여부를 본다 (BR-03)', () => {
    expect(titles(similarMilestones(records, { type: 'word', title: 'MAMMA' }))).toEqual(['Mam ma'])
  })

  it('유형을 고르기 전이나 내용이 비어 있으면 없다', () => {
    expect(similarMilestones(records, { type: '', title: '마' })).toEqual([])
    expect(similarMilestones(records, { type: 'word', title: ' ' })).toEqual([])
  })

  it('수정 중인 기록은 빼고, 최대 5개만 고른다', () => {
    expect(titles(similarMilestones(records, { type: 'word', title: '마' }, 'w3'))).toEqual([
      '맘마',
    ])
    const many = Array.from({ length: 7 }, (_, i): Milestone => ({
      id: `p${i}`,
      type: 'play',
      date: '2026-10-01',
      title: `까꿍놀이 ${i}`,
      memo: null,
    }))
    expect(similarMilestones(many, { type: 'play', title: '까꿍' })).toHaveLength(5)
  })
})

describe('findDuplicate (FR-MS-06)', () => {
  it('같은 유형에 같은 내용이 있으면 그 기록을 돌려준다', () => {
    expect(findDuplicate(records, { type: 'word', title: ' 맘마 ' })?.id).toBe('w2')
    expect(findDuplicate(records, { type: 'word', title: 'mam  MA' })?.id).toBe('w1')
  })

  it('포함만 하거나 유형이 다르면 같은 내용이 아니다', () => {
    expect(findDuplicate(records, { type: 'word', title: '맘' })).toBeUndefined()
    expect(findDuplicate(records, { type: 'play', title: '잡고 서기' })).toBeUndefined()
  })

  it('수정 중인 기록 자신은 중복으로 보지 않는다', () => {
    expect(findDuplicate(records, { type: 'word', title: '맘마' }, 'w2')).toBeUndefined()
  })

  it('같은 내용이 여러 개면 가장 최근 기록을 돌려준다', () => {
    const twice = [{ ...records[2], id: 'w5', date: '2026-10-21' }, ...records]
    expect(findDuplicate(twice, { type: 'word', title: '맘마' })?.id).toBe('w5')
  })
})

describe('duplicateKey', () => {
  it('유형과 정리한 내용으로 만든다', () => {
    expect(duplicateKey({ type: 'word', title: ' Mam  MA ' })).toBe('word:mam ma')
    expect(duplicateKey({ type: 'word', title: '맘마' })).not.toBe(
      duplicateKey({ type: 'play', title: '맘마' }),
    )
  })
})
