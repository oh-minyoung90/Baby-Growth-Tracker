import { QueryClient } from '@tanstack/react-query'

// 서버 데이터 조회·캐시 기본값 (기술요구사항서 3장, TanStack Query)
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 30초 안에 같은 데이터를 다시 열면 캐시를 그대로 보여 준다
      staleTime: 30_000,
      // 실패하면 한 번만 다시 시도하고 오류 화면을 보여 준다 (기능요구사항서 3.4)
      retry: 1,
    },
    mutations: { retry: 0 },
  },
})
