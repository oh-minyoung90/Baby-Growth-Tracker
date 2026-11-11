import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteMealEntry,
  fetchMealEntry,
  fetchMealWeek,
  saveMealEntry,
  MealSaveError,
  type MealInput,
} from './mealApi'
import { FOODS_QUERY_KEY } from './useFoods'

export const MEALS_QUERY_KEY = ['meals'] as const
export function useMealWeek(start: string, end: string) {
  return useQuery({
    queryKey: [...MEALS_QUERY_KEY, start],
    queryFn: () => fetchMealWeek(start, end),
  })
}

export function useMealEntry(id: string | undefined) {
  return useQuery({
    queryKey: [...MEALS_QUERY_KEY, 'entry', id],
    queryFn: () => fetchMealEntry(id!),
    enabled: !!id,
  })
}
export function useSaveMeal() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ input, id }: { input: MealInput; id?: string }) => saveMealEntry(input, id),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: MEALS_QUERY_KEY }),
        client.invalidateQueries({ queryKey: FOODS_QUERY_KEY }),
      ]),
    onError: (error) => {
      // 다른 기기에서 먼저 저장했어도 입력을 유지하고, 닫고 다시 열 수 있게 목록만 갱신한다.
      if (error instanceof MealSaveError && error.reason === 'duplicate')
        return client.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === MEALS_QUERY_KEY[0] && query.queryKey[1] !== 'entry',
        })
      if (error instanceof MealSaveError && error.reason === 'staleItem')
        return client.invalidateQueries({ queryKey: FOODS_QUERY_KEY })
    },
  })
}
export function useDeleteMeal() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteMealEntry(id),
    onSuccess: () =>
      Promise.all([
        // 닫히기 전에 지운 기록의 조회가 다시 실행되지 않게 목록만 새로 불러온다.
        client.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === MEALS_QUERY_KEY[0] && query.queryKey[1] !== 'entry',
        }),
        client.invalidateQueries({ queryKey: MEALS_QUERY_KEY, refetchType: 'none' }),
        client.invalidateQueries({ queryKey: FOODS_QUERY_KEY }),
      ]),
  })
}
