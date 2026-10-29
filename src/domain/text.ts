/**
 * 발달 기록 내용 비교 규칙 (BR-03, 기능요구사항서 FR-MS-05~06, FR-TL-08).
 * 음식 이름 중복(BR-18)도 같은 규칙으로 비교한다.
 *
 * DB의 milestones.title_key(T-18)와 foods.name_key(T-36) 생성 컬럼도 같은 규칙으로 만들어야 한다.
 *   SQL: lower(regexp_replace(btrim(normalize(title, NFC)), '\s+', ' ', 'g'))
 */

/**
 * "같은 내용" 비교용 키: 유니코드 NFC 정규화, 앞뒤 공백 제거, 연속 공백은 하나로, 영문 소문자.
 * NFC 정규화는 macOS 등에서 한글이 자모 단위(NFD)로 입력되는 경우를 같은 글자로 맞추기 위함이다.
 */
export function toContentKey(text: string): string {
  return text.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase()
}

/** 두 내용이 같은지 (공백·대소문자 차이 무시) */
export function isSameContent(a: string, b: string): boolean {
  return toContentKey(a) === toContentKey(b)
}

/** "비슷한 내용" 검색용 키: 공백을 모두 뺀 키 */
function toSearchKey(text: string): string {
  return toContentKey(text).replace(/ /g, '')
}

/** 입력값(query)이 기록 내용에 포함되면 비슷한 내용으로 본다. 빈 입력은 비슷하지 않다. */
export function isSimilarContent(query: string, title: string): boolean {
  const q = toSearchKey(query)
  return q.length > 0 && toSearchKey(title).includes(q)
}

/** 비슷한 기록을 입력 순서대로 최대 limit개 고른다 (FR-MS-05: 5개) */
export function findSimilar<T extends { title: string }>(
  query: string,
  records: readonly T[],
  limit = 5,
): T[] {
  return records.filter((r) => isSimilarContent(query, r.title)).slice(0, limit)
}

/** 같은 내용 중복을 1개로 셌을 때의 개수 (FR-TL-08 유형별 개수, R28) */
export function countDistinctContent(titles: readonly string[]): number {
  return new Set(titles.map(toContentKey)).size
}
