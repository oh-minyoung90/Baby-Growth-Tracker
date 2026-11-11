import { useQuery } from '@tanstack/react-query'
import { fetchMealWeek } from './mealApi'

export const MEALS_QUERY_KEY = ['meals'] as const
export function useMealWeek(start: string, end: string) {
  return useQuery({
    queryKey: [...MEALS_QUERY_KEY, start],
    queryFn: () => fetchMealWeek(start, end),
  })
}
