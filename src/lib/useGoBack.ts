import { useLocation, useNavigate } from 'react-router'

/**
 * 진입했던 화면으로 돌아간다 (기능요구사항서 2.3: 저장·취소 후에는 진입했던 화면으로).
 * 이 주소로 바로 들어왔으면(새로 고침, 북마크) 돌아갈 곳이 없으므로 fallback 화면으로 간다.
 */
export function useGoBack(fallback: string) {
  const location = useLocation()
  const navigate = useNavigate()
  return () => {
    if (location.key !== 'default') void navigate(-1)
    else void navigate(fallback, { replace: true })
  }
}
