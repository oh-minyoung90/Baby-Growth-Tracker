import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createSleepLog,
  deleteSleepLog,
  fetchSleepLogs,
  updateSleepLog,
  type SleepLogInput,
} from './sleepApi'

/** 수면 기록 조회 키. 저장·삭제하면 다시 불러온다 */
export const SLEEP_LOGS_QUERY_KEY = ['sleepLogs'] as const

/** 수면 기록 전체 (수면일 최신순). 수면일당 1건이라 입력 화면도 이 목록에서 기록을 찾는다 */
export function useSleepLogs() {
  return useQuery({ queryKey: SLEEP_LOGS_QUERY_KEY, queryFn: fetchSleepLogs })
}

// 저장·삭제 후 목록은 기다리지 않고 다시 불러온다. 입력 화면은 이 목록으로 수면일의 기록을 찾기 때문에,
// 기다리면 화면을 떠나기 전에 입력 화면이 새 목록으로 바뀌어 보인다 (예: 지운 기록 "찾을 수 없어요")

/** 수면 기록 저장. id가 있으면 수정, 없으면 새로 만든다 */
export function useSaveSleepLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: SleepLogInput }) =>
      id ? updateSleepLog(id, input) : createSleepLog(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: SLEEP_LOGS_QUERY_KEY }),
  })
}

export function useDeleteSleepLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteSleepLog(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: SLEEP_LOGS_QUERY_KEY }),
  })
}
