import { isSimilarContent } from '@/domain/text'
import type { Food } from '@/lib/foodApi'
import {
  FOOD_STATUSES,
  isFoodGroup,
  isFoodStatus,
  type FoodGroup,
  type FoodStatus,
} from '@/lib/foodTypes'

/** 음식 목록의 상태 탭·식품군 필터·이름 검색 (FR-FOOD-01~02) */

export type FoodGroupFilter = FoodGroup | 'all'

export interface FoodFilter {
  status: FoodStatus
  group: FoodGroupFilter
  /** 이름 검색어. 비어 있으면 전체 */
  query: string
}

/** 주소의 검색 조건: ?status=not_tried&group=fruit. 기본값(먹어봄, 전체)은 주소에 남기지 않는다 */
export function filterFromParams(params: URLSearchParams): Pick<FoodFilter, 'status' | 'group'> {
  const status = params.get('status')
  const group = params.get('group')
  return {
    // 기본 탭은 먹어봄 (FR-FOOD-01)
    status: isFoodStatus(status) ? status : 'tried',
    group: isFoodGroup(group) ? group : 'all',
  }
}

/** 기존 검색 조건(시트 열림 등)은 두고 탭·식품군만 바꾼다 */
export function filterToParams(
  params: URLSearchParams,
  { status, group }: Pick<FoodFilter, 'status' | 'group'>,
): URLSearchParams {
  const next = new URLSearchParams(params)
  if (status === 'tried') next.delete('status')
  else next.set('status', status)
  if (group === 'all') next.delete('group')
  else next.set('group', group)
  return next
}

/** 상태별 음식 수. 식품군·검색과 상관없는 전체 개수다 (FR-FOOD-01) */
export function countByStatus(foods: readonly Food[]): Record<FoodStatus, number> {
  const counts = Object.fromEntries(FOOD_STATUSES.map(({ value }) => [value, 0])) as Record<
    FoodStatus,
    number
  >
  for (const food of foods) counts[food.status] += 1
  return counts
}

/**
 * 탭·식품군·검색어에 맞는 음식. 순서는 그대로 둔다 (이름 가나다순).
 * 검색은 발달 기록의 "비슷한 내용"과 같이 띄어쓰기·대소문자를 무시하고 이름에 포함되면 찾는다
 */
export function filterFoods(foods: readonly Food[], { status, group, query }: FoodFilter): Food[] {
  const searching = query.trim() !== ''
  return foods.filter(
    (food) =>
      food.status === status &&
      (group === 'all' || food.group === group) &&
      (!searching || isSimilarContent(query, food.name)),
  )
}

/** 여러 줄 메모의 첫 줄 (FR-FOOD-03: 증상 메모 첫 줄). 비어 있으면 null */
export function firstLine(text: string | null): string | null {
  const line = text?.split('\n').find((part) => part.trim() !== '')
  return line ? line.trim() : null
}
