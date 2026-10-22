import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './auth'
import { fetchMyChild, saveChild, type ChildInput } from './childApi'

export const CHILD_QUERY_KEY = ['child'] as const

/** 아이 정보 조회 (로그인한 경우에만) */
export function useChild() {
  const auth = useAuth()
  return useQuery({
    queryKey: CHILD_QUERY_KEY,
    queryFn: fetchMyChild,
    enabled: auth.status === 'signedIn',
  })
}

/** 아이 정보 저장. 성공하면 캐시를 바로 바꿔 화면에 반영한다 */
export function useSaveChild() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ChildInput) => {
      if (auth.status !== 'signedIn') throw new Error('로그인이 필요합니다')
      return saveChild(auth.session.user.id, input)
    },
    onSuccess: (child) => queryClient.setQueryData(CHILD_QUERY_KEY, child),
  })
}
