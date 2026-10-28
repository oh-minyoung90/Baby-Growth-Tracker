import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createBodyMeasure,
  deleteBodyMeasure,
  fetchBodyMeasures,
  updateBodyMeasure,
  type BodyMeasureInput,
} from './bodyApi'

export const BODY_MEASURES_QUERY_KEY = ['bodyMeasures'] as const

/** 측정 기록 목록 (최신순) */
export function useBodyMeasures() {
  return useQuery({ queryKey: BODY_MEASURES_QUERY_KEY, queryFn: fetchBodyMeasures })
}

/**
 * 측정 기록 저장. id가 있으면 수정, 없으면 새로 만든다.
 * 저장 후 목록을 다시 불러와 바로 반영한다 (FR-BODY-07). 다시 불러올 때까지 저장 중으로 둔다.
 */
export function useSaveBodyMeasure() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: BodyMeasureInput }) =>
      id ? updateBodyMeasure(id, input) : createBodyMeasure(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BODY_MEASURES_QUERY_KEY }),
  })
}

export function useDeleteBodyMeasure() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteBodyMeasure(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BODY_MEASURES_QUERY_KEY }),
  })
}
