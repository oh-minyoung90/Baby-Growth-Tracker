import type { Food } from './foodApi'
import type { MealItem } from './mealApi'

/** 실제 레시피 재료 목록은 T-47·T-51에서 조회해 연결한다. 삭제된 재료는 이름만 남는다. */
export interface MealRecipeOption extends MealItem {
  ingredients?: readonly MealItem[]
}

/** 이름 스냅샷이 아닌 현재 음식 ID·상태로 경고한다. 같은 재료는 한 번만 표시한다. */
export function mealCautionFoods(
  foods: readonly MealItem[],
  recipes: readonly MealItem[],
  catalog: readonly Food[],
  recipeOptions: readonly MealRecipeOption[] = [],
): Food[] {
  const ids = new Set(foods.map((food) => food.id).filter((id) => id !== null))
  for (const recipe of recipes) {
    if (!recipe.id) continue
    for (const item of recipeOptions.find((option) => option.id === recipe.id)?.ingredients ?? []) {
      if (item.id) ids.add(item.id)
    }
  }
  return catalog.filter(
    (food) => ids.has(food.id) && (food.status === 'caution' || food.cautionTag),
  )
}

export function mealCautionMessage(foods: readonly Pick<Food, 'name'>[]): string {
  return `주의가 필요한 음식이 있어요: ${foods.map((food) => food.name).join(', ')}`
}
