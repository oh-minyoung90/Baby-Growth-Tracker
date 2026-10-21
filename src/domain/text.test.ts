import { describe, expect, it } from 'vitest'
import {
  countDistinctContent,
  findSimilar,
  isSameContent,
  isSimilarContent,
  toContentKey,
} from './text'

describe('toContentKey / isSameContent (BR-03 같은 내용)', () => {
  it('앞뒤 공백을 지운다', () => {
    expect(isSameContent('  잡고 서기 ', '잡고 서기')).toBe(true)
  })

  it('연속 공백은 하나로 본다', () => {
    expect(isSameContent('잡고   서기', '잡고 서기')).toBe(true)
  })

  it('영문 대소문자를 구분하지 않는다', () => {
    expect(isSameContent('Bye Bye', 'bye bye')).toBe(true)
  })

  it('띄어쓰기 유무는 다른 내용으로 본다', () => {
    expect(isSameContent('잡고서기', '잡고 서기')).toBe(false)
  })

  it('한글 자모 분리 입력(NFD)도 같은 글자로 본다', () => {
    const nfd = '맘마'.normalize('NFD')
    expect(nfd).not.toBe('맘마')
    expect(isSameContent(nfd, '맘마')).toBe(true)
  })

  it('키 형식', () => {
    expect(toContentKey('  Peek  A  Boo ')).toBe('peek a boo')
  })
})

describe('isSimilarContent (BR-03 비슷한 내용)', () => {
  it('입력값이 포함되면 비슷하다', () => {
    expect(isSimilarContent('잡고', '잡고 서기')).toBe(true)
  })

  it('공백을 빼고 비교한다', () => {
    expect(isSimilarContent('잡고서', '잡고 서기')).toBe(true)
    expect(isSimilarContent('잡고 서기', '잡고서기')).toBe(true)
  })

  it('빈 입력이나 공백만 있으면 비슷하지 않다', () => {
    expect(isSimilarContent('', '잡고 서기')).toBe(false)
    expect(isSimilarContent('   ', '잡고 서기')).toBe(false)
  })

  it('포함되지 않으면 비슷하지 않다', () => {
    expect(isSimilarContent('뒤집기', '잡고 서기')).toBe(false)
  })
})

describe('findSimilar', () => {
  const records = [
    { title: '잡고 서기', date: '2026-10-12' },
    { title: '잡고 걷기', date: '2026-10-16' },
    { title: '혼자 앉기', date: '2026-08-30' },
  ]

  it('비슷한 기록만 입력 순서대로 고른다', () => {
    expect(findSimilar('잡고', records).map((r) => r.title)).toEqual(['잡고 서기', '잡고 걷기'])
  })

  it('최대 개수를 넘지 않는다', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ title: `까꿍${i}` }))
    expect(findSimilar('까꿍', many)).toHaveLength(5)
  })
})

describe('countDistinctContent (FR-WORD-01 단어 수)', () => {
  it('같은 내용 중복은 1개로 센다', () => {
    expect(countDistinctContent(['맘마', ' 맘마', '엄마', '아빠', '아빠 '])).toBe(3)
  })

  it('0건이면 0', () => {
    expect(countDistinctContent([])).toBe(0)
  })
})
