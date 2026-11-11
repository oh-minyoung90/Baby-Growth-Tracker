import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchFood, setFoodPreference } from './foodApi'
import { fetchFoodEatenMeals, fetchFoodMealCounts, fetchFoodStatusHistory } from './foodDetailApi'
import type { FoodPreference } from './foodTypes'
import { FOODS_QUERY_KEY } from './useFoods'

export function useFood(id: string) {
  return useQuery({ queryKey: [...FOODS_QUERY_KEY, 'detail', id], queryFn: () => fetchFood(id) })
}
export function useFoodMealCounts() {
  return useQuery({ queryKey: [...FOODS_QUERY_KEY, 'meal-counts'], queryFn: fetchFoodMealCounts })
}
export function useFoodEatenMeals(id: string) {
  return useInfiniteQuery({
    queryKey: [...FOODS_QUERY_KEY, 'eaten-meals', id],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchFoodEatenMeals(id, pageParam),
    getNextPageParam: (page) => page.nextOffset,
  })
}
export function useFoodStatusHistory(id: string) {
  return useInfiniteQuery({
    queryKey: [...FOODS_QUERY_KEY, 'history', id],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchFoodStatusHistory(id, pageParam),
    getNextPageParam: (page) => page.nextOffset,
  })
}
export function useSetFoodPreference() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, preference }: { id: string; preference: FoodPreference | null }) =>
      setFoodPreference(id, preference),
    onSettled: () => client.invalidateQueries({ queryKey: FOODS_QUERY_KEY }),
  })
}
