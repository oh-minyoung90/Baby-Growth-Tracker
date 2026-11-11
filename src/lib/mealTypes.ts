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

export const MEAL_INTAKES = [
  { value: 'good', label: '잘 먹음' },
  { value: 'normal', label: '보통' },
  { value: 'refuse', label: '거부' },
] as const
export type MealIntake = (typeof MEAL_INTAKES)[number]['value']
export function isMealIntake(value: string | null): value is MealIntake {
  return MEAL_INTAKES.some((intake) => intake.value === value)
}
export function mealIntakeLabel(value: MealIntake) {
  return MEAL_INTAKES.find((intake) => intake.value === value)!.label
}
