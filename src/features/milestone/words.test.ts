import { describe, expect, it } from 'vitest'
import type { Milestone } from './milestoneApi'
import { firstWords, sortWords } from './words'

// 단어 목록 (FR-WORD-01~02). 기록은 가명 예시, 날짜 최신순(같은 날짜는 나중에 저장한 것이 먼저)
function word(id: string, date: string, title: string): Milestone {
  return { id, type: 'word', date, title, memo: null }
}

const records: Milestone[] = [
  word('w6', '2026-10-19', '맘마'),
  word('w5', '2026-10-14', '아빠'),
  { id: 'b1', type: 'behavior', date: '2026-10-12', title: '잡고 서기', memo: null },
  word('w4', '2026-10-05', 'Bye bye'),
  word('w3', '2026-09-15', '맘마'),
  word('w2', '2026-09-02', '엄마'),
  word('w1', '2026-09-02', 'bye  BYE'),
]

const ids = (list: Milestone[]) => list.map((record) => record.id)

describe('firstWords', () => {
  it('같은 단어(BR-03)는 처음 기록한 것 하나만 남기고, 처음 기록한 날짜 최신순으로 둔다', () => {
    expect(ids(firstWords(records))).toEqual(['w5', 'w3', 'w2', 'w1'])
  })

  it('단어가 아닌 기록은 빼고, 없으면 빈 목록', () => {
    expect(firstWords(records).every((record) => record.type === 'word')).toBe(true)
    expect(firstWords([])).toEqual([])
  })
})

describe('sortWords', () => {
  const words = firstWords(records)

  it('최근순은 그대로 둔다', () => {
    expect(ids(sortWords(words, 'recent'))).toEqual(['w5', 'w3', 'w2', 'w1'])
  })

  it('가나다순. 한글 다음에 영문', () => {
    expect(sortWords(words, 'name').map((record) => record.title)).toEqual([
      '맘마',
      '아빠',
      '엄마',
      'bye  BYE',
    ])
  })
})
