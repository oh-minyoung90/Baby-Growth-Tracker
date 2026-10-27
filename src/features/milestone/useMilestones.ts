import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createMilestone,
  deleteMilestone,
  fetchMilestone,
  updateMilestone,
  type MilestoneInput,
} from './milestoneApi'

/** 발달 기록 조회 키. 저장·삭제하면 이 키로 시작하는 목록·기록을 다시 불러온다 */
export const MILESTONES_QUERY_KEY = ['milestones'] as const

function detailKey(id: string | undefined) {
  return [...MILESTONES_QUERY_KEY, 'detail', id] as const
}

/** 수정할 기록 하나 */
export function useMilestone(id: string | undefined) {
  return useQuery({
    queryKey: detailKey(id),
    queryFn: () => fetchMilestone(id ?? ''),
    enabled: id !== undefined,
  })
}

/** 발달 기록 저장. id가 있으면 수정, 없으면 새로 만든다 */
export function useSaveMilestone() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: MilestoneInput }) =>
      id ? updateMilestone(id, input) : createMilestone(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MILESTONES_QUERY_KEY }),
  })
}

export function useDeleteMilestone() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteMilestone(id),
    // 지운 기록은 다시 불러오지 않는다 (수정 화면에 "찾을 수 없어요"가 잠깐 보이지 않게)
    onSuccess: (_, id) =>
      queryClient.invalidateQueries({
        queryKey: MILESTONES_QUERY_KEY,
        predicate: (query) => query.queryKey.join() !== detailKey(id).join(),
      }),
  })
}
