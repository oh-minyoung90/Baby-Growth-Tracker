import { findSimilar, isSameContent, toContentKey } from '@/domain/text'
import type { MilestoneType } from '@/lib/milestoneTypes'
import type { Milestone } from '@/lib/milestoneApi'

/**
 * 비슷한 기록·같은 내용 찾기 (F-07, FR-MS-05~06). 비교 규칙은 BR-03(domain/text.ts)을 따른다.
 * records는 날짜 최신순이고, 수정 중인 기록(excludeId)은 비교 대상에서 뺀다.
 */

function sameTypeOthers(records: readonly Milestone[], type: MilestoneType, excludeId?: string) {
  return records.filter((record) => record.type === type && record.id !== excludeId)
}

/** 입력 중인 내용을 포함하는 같은 유형의 기록. 최대 5개 (FR-MS-05). 유형을 고르기 전에는 없다 */
export function similarMilestones(
  records: readonly Milestone[],
  { type, title }: { type: MilestoneType | ''; title: string },
  excludeId?: string,
): Milestone[] {
  return type ? findSimilar(title, sameTypeOthers(records, type, excludeId)) : []
}

/** 같은 유형에 같은 내용이 있으면 그 기록 (FR-MS-06). 여러 개면 가장 최근 기록 */
export function findDuplicate(
  records: readonly Milestone[],
  { type, title }: { type: MilestoneType; title: string },
  excludeId?: string,
): Milestone | undefined {
  return sameTypeOthers(records, type, excludeId).find((record) =>
    isSameContent(record.title, title),
  )
}

/** 유형 + 같은 내용 키. 이미 확인한 내용인지 가릴 때 쓴다 */
export function duplicateKey({ type, title }: { type: MilestoneType; title: string }): string {
  return `${type}:${toContentKey(title)}`
}
