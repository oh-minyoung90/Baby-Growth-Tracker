import { useQuery } from '@tanstack/react-query'
import { getRecipePhotoUrl } from './recipePhotoApi'
export const PHOTOS_QUERY_KEY = ['recipe-photos'] as const
/** 공개 URL을 만들지 않고 1시간 만료 전에 다시 서명한다. 로그아웃 시 공통 Query 캐시가 비워진다. */
export function useRecipePhoto(id: string | null) {
  return useQuery({
    queryKey: [...PHOTOS_QUERY_KEY, id],
    queryFn: () => getRecipePhotoUrl(id!),
    enabled: !!id,
    staleTime: 45 * 60 * 1000,
    refetchInterval: 50 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  })
}
