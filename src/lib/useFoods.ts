import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  clearCautionTag,
  createFood,
  deleteFood,
  fetchFoods,
  releaseFoodCaution,
  seedDefaultFoods,
  setFoodCaution,
  updateFood,
  type CautionInput,
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

/**
 * 알러지·주의 음식 수정 (FR-FOOD-04, 11): 이름·식품군·메모(input)와 알러지·주의 정보(caution) 중 넘긴 것만 저장한다.
 * 두 번에 나눠 저장하므로 앞의 것만 저장되고 실패할 수 있어, 실패해도 목록을 다시 불러온다
 */
export function useSaveCautionFood() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      input,
      caution,
    }: {
      id: string
      input?: FoodInput
      caution?: CautionInput
    }) => {
      if (input) await updateFood(id, input)
      if (caution) await setFoodCaution(id, caution)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: FOODS_QUERY_KEY }),
  })
}

/** 알러지·주의 지정 (FR-FOOD-11). 사유는 이력에 남는다 */
export function useSetFoodCaution() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      input,
      reason,
    }: {
      id: string
      input: CautionInput
      reason: string | null
    }) => setFoodCaution(id, input, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FOODS_QUERY_KEY }),
  })
}

/** 알러지·주의 해제 (FR-FOOD-12). 바뀐 음식을 돌려준다 (먹어봄 또는 아직 안 먹어봄) */
export function useReleaseFoodCaution() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string | null }) =>
      releaseFoodCaution(id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FOODS_QUERY_KEY }),
  })
}

/** "주의" 태그 해제 (FR-FOOD-13) */
export function useClearCautionTag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string | null }) =>
      clearCautionTag(id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FOODS_QUERY_KEY }),
  })
}
