import { useMemo } from 'react'
import type { MealRecipeOption } from './mealCaution'
import { useRecipes } from './useRecipes'

/** 식단 선택·먹음 체크·복사는 동일한 최신 레시피 재료 목록으로 경고한다. */
export function useMealRecipes() {
  const query = useRecipes()
  const options = useMemo<MealRecipeOption[]>(
    () =>
      (query.data ?? []).map((recipe) => ({
        id: recipe.id,
        name: recipe.name,
        ingredients: recipe.ingredients.map((item) => ({ id: item.foodId, name: item.name })),
      })),
    [query.data],
  )
  return { ...query, options }
}
