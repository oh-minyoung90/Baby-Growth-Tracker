export const MEAL_TYPES = [
  { value: 'breakfast', label: '아침' },
  { value: 'lunch', label: '점심' },
  { value: 'dinner', label: '저녁' },
  { value: 'snack', label: '간식' },
] as const

export type MealType = (typeof MEAL_TYPES)[number]['value']
export function isMealType(value: string | null): value is MealType {
  return MEAL_TYPES.some((type) => type.value === value)
}
export function mealTypeLabel(value: MealType) {
  return MEAL_TYPES.find((type) => type.value === value)!.label
}

export type MealIntake = 'good' | 'normal' | 'refuse'
export function isMealIntake(value: string | null): value is MealIntake {
  return value === 'good' || value === 'normal' || value === 'refuse'
}

export const MEAL_STATUSES = [
  { value: 'planned', label: '예정' },
  { value: 'good', label: '잘 먹음' },
  { value: 'eaten', label: '먹음' },
  { value: 'refused', label: '거부' },
] as const

export type MealStatus = (typeof MEAL_STATUSES)[number]['value']
export function mealStatusLabel(status: MealStatus) {
  return MEAL_STATUSES.find(({ value }) => value === status)!.label
}

export function getMealStatus({
  eaten,
  intake,
}: {
  eaten: boolean
  intake: MealIntake | null
}): MealStatus {
  // 이전 기록은 실제 섭취 여부를 저장하던 먹음 체크를 우선한다.
  if (eaten) return intake === 'good' ? 'good' : 'eaten'
  return intake === 'refuse' ? 'refused' : 'planned'
}

export function mealStatusFields(status: MealStatus): {
  eaten: boolean
  intake: MealIntake | null
} {
  switch (status) {
    case 'planned':
      return { eaten: false, intake: null }
    case 'good':
      return { eaten: true, intake: 'good' }
    case 'eaten':
      return { eaten: true, intake: null }
    case 'refused':
      return { eaten: false, intake: 'refuse' }
  }
}
