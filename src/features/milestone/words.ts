import { toContentKey } from '@/domain/text'
import type { Milestone } from '@/lib/milestoneApi'

/** 단어 목록 정렬: 최근순(기본) / 가나다순 (FR-WORD-02) */
export type WordSort = 'recent' | 'name'

export const WORD_SORTS: { value: WordSort; label: string }[] = [
  { value: 'recent', label: '최근순' },
  { value: 'name', label: '가나다순' },
]

/**
 * 단어 기록을 같은 내용(BR-03)끼리 묶어 처음 기록한 것 하나씩 고른다 (FR-WORD-01~02).
 * 개수가 "말할 수 있는 단어 수"이고, 각 기록의 날짜가 처음 기록한 날짜다.
 * records는 날짜 최신순(같은 날짜는 나중에 저장한 것이 먼저)이고, 결과도 처음 기록한 날짜 최신순이다.
 */
export function firstWords(records: readonly Milestone[]): Milestone[] {
  const first = new Map<string, Milestone>()
  // 오래된 기록부터 보며 처음 나온 단어만 남긴다
  for (const record of [...records].reverse()) {
    const key = toContentKey(record.title)
    if (record.type === 'word' && !first.has(key)) first.set(key, record)
  }
  return [...first.values()].reverse()
}

const collator = new Intl.Collator('ko')

export function sortWords(words: readonly Milestone[], sort: WordSort): Milestone[] {
  return sort === 'name'
    ? [...words].sort((a, b) => collator.compare(a.title, b.title))
    : [...words]
}
