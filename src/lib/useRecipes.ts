import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchRecipe, fetchRecipes } from './recipeApi'
import { PHOTOS_QUERY_KEY } from './useRecipePhoto'
import { MEALS_QUERY_KEY } from './mealApi'

export const RECIPES_QUERY_KEY = ['recipes'] as const
export function useRecipes() {
  return useQuery({ queryKey: RECIPES_QUERY_KEY, queryFn: fetchRecipes })
}
export function useRecipe(id?: string) {
  return useQuery({
    queryKey: [...RECIPES_QUERY_KEY, id],
    queryFn: () => fetchRecipe(id!),
    enabled: !!id,
  })
}
export function useInvalidateRecipes() {
  const client = useQueryClient()
  return async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: RECIPES_QUERY_KEY }),
      client.invalidateQueries({ queryKey: PHOTOS_QUERY_KEY }),
      client.invalidateQueries({ queryKey: MEALS_QUERY_KEY }),
    ])
  }
}
