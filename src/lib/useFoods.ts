import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createFood,
  deleteFood,
  fetchFoods,
  seedDefaultFoods,
  updateFood,
  type FoodInput,
} from './foodApi'

export const FOODS_QUERY_KEY = ['foods'] as const

/** 음식 목록 (이름 가나다순) */
export function useFoods() {
  return useQuery({ queryKey: FOODS_QUERY_KEY, queryFn: fetchFoods })
}

/** 음식 저장. id가 있으면 수정, 없으면 새로 추가한다. 저장 후 목록을 다시 불러온다 */
export function useSaveFood() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: FoodInput }) =>
      id ? updateFood(id, input) : createFood(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FOODS_QUERY_KEY }),
  })
}

export function useDeleteFood() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteFood(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FOODS_QUERY_KEY }),
  })
}

/** 기본 음식 추가 (FR-FOOD-07). 추가한 수를 돌려준다 */
export function useSeedDefaultFoods() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: seedDefaultFoods,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FOODS_QUERY_KEY }),
  })
}
