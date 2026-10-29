/**
 * 음식의 식품군·상태·반응 (F-13, BR-10). 음식 목록, 식단, 레시피 화면이 함께 쓴다.
 * 값은 DB foods 테이블의 CHECK 제약과 같다 (T-36).
 */

export type FoodGroup = 'grain' | 'vegetable' | 'fruit' | 'protein' | 'dairy' | 'etc'

/** 식품군 (FR-FOOD-02). 필터와 입력 화면에 이 순서로 보여 준다 */
export const FOOD_GROUPS: readonly { value: FoodGroup; label: string }[] = [
  { value: 'grain', label: '곡류' },
  { value: 'vegetable', label: '채소' },
  { value: 'fruit', label: '과일' },
  { value: 'protein', label: '육류·생선' },
  { value: 'dairy', label: '유제품' },
  { value: 'etc', label: '기타' },
]

export const FOOD_GROUP_VALUES = FOOD_GROUPS.map((group) => group.value) as [
  FoodGroup,
  ...FoodGroup[],
]

export function isFoodGroup(value: string | null | undefined): value is FoodGroup {
  return FOOD_GROUPS.some((group) => group.value === value)
}

export function foodGroupLabel(value: FoodGroup): string {
  return FOOD_GROUPS.find((group) => group.value === value)?.label ?? value
}

/** 음식 상태 (BR-10): 먹어봄 / 아직 안 먹어봄 / 알러지·주의 */
export type FoodStatus = 'tried' | 'not_tried' | 'caution'

/** 음식 목록의 상태 탭 순서 (FR-FOOD-01). shortLabel은 좁은 탭에 쓰는 이름 (시안 D-07) */
export const FOOD_STATUSES: readonly { value: FoodStatus; label: string; shortLabel: string }[] = [
  { value: 'tried', label: '먹어봄', shortLabel: '먹어봄' },
  { value: 'not_tried', label: '아직 안 먹어봄', shortLabel: '안 먹어봄' },
  { value: 'caution', label: '알러지·주의', shortLabel: '주의' },
]

export function isFoodStatus(value: string | null | undefined): value is FoodStatus {
  return FOOD_STATUSES.some((status) => status.value === value)
}

/** 아이 반응 (FR-FOOD-10): 음식 상세에서 사용자가 고른다 */
export type FoodPreference = 'like' | 'neutral' | 'refuse'

export const FOOD_PREFERENCES: readonly { value: FoodPreference; label: string }[] = [
  { value: 'like', label: '좋아함' },
  { value: 'neutral', label: '보통' },
  { value: 'refuse', label: '거부' },
]

export function isFoodPreference(value: string | null | undefined): value is FoodPreference {
  return FOOD_PREFERENCES.some((preference) => preference.value === value)
}

export function foodPreferenceLabel(value: FoodPreference): string {
  return FOOD_PREFERENCES.find((preference) => preference.value === value)?.label ?? value
}
