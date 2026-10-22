/**
 * 이름 뒤 조사 고르기. 아이 이름은 사용자가 정하므로 받침 유무에 따라 조사를 바꾼다.
 * 예: 하늘이는, 민준은, 예서는
 */

const HANGUL_START = 0xac00
const HANGUL_END = 0xd7a3

/** 마지막 글자의 받침 여부. 한글이 아니면 null (조사를 확정할 수 없음) */
export function hasFinalConsonant(word: string): boolean | null {
  const last = word.trim().at(-1)
  if (!last) return null
  const code = last.charCodeAt(0)
  if (code < HANGUL_START || code > HANGUL_END) return null
  return (code - HANGUL_START) % 28 !== 0
}

/** 은/는: 받침이 있으면 "은", 없으면 "는", 한글이 아니면 "은(는)" */
export function withTopicParticle(word: string): string {
  const batchim = hasFinalConsonant(word)
  const particle = batchim === null ? '은(는)' : batchim ? '은' : '는'
  return `${word.trim()}${particle}`
}
