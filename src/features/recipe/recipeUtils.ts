import type { Food } from '@/lib/foodApi'
import type { Recipe } from '@/lib/recipeApi'
export function cautionIngredientNames(recipe: Recipe, foods: readonly Food[]): string[] {
  const cautionIds = new Set(
    foods.filter((f) => f.status === 'caution' || f.cautionTag).map((f) => f.id),
  )
  return [
    ...new Set(
      recipe.ingredients.filter((i) => i.foodId && cautionIds.has(i.foodId)).map((i) => i.name),
    ),
  ]
}
export function filterRecipes(
  recipes: readonly Recipe[],
  search: string,
  foodIds: readonly string[],
) {
  return recipes.filter(
    (r) =>
      r.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()) &&
      foodIds.every((id) => r.ingredients.some((i) => i.foodId === id)),
  )
}
