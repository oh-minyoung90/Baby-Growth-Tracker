import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './auth'
import { fetchMyChild, saveChild, type ChildInput } from './childApi'
import { seedDefaultFoods } from './foodApi'
import { FOODS_QUERY_KEY } from './useFoods'

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

/**
 * 아이 정보 저장. 성공하면 캐시를 바로 바꿔 화면에 반영한다.
 * 첫 등록(withDefaultFoods)이면 기본 음식 목록도 함께 추가한다 (FR-FOOD-07).
 * 기본 음식 추가가 실패하면 저장 실패로 알린다. 다시 시도하면 아이 정보는 덮어쓰고(upsert)
 * 기본 음식은 같은 이름을 건너뛰므로 두 번 저장되지 않는다.
 */
export function useSaveChild({ withDefaultFoods = false }: { withDefaultFoods?: boolean } = {}) {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ChildInput) => {
      if (auth.status !== 'signedIn') throw new Error('로그인이 필요합니다')
      const child = await saveChild(auth.session.user.id, input)
      if (withDefaultFoods) await seedDefaultFoods()
      return child
    },
    onSuccess: (child) => {
      // 등록 화면은 아이 정보가 생기면 바로 홈으로 넘어가므로, 기본 음식까지 저장한 뒤에 캐시를 바꾼다
      queryClient.setQueryData(CHILD_QUERY_KEY, child)
      if (withDefaultFoods) void queryClient.invalidateQueries({ queryKey: FOODS_QUERY_KEY })
    },
  })
}
