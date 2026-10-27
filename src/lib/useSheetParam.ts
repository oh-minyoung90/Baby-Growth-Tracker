import { useLocation, useNavigate, useSearchParams } from 'react-router'

/**
 * 바텀 시트를 주소의 검색 조건으로 연다: `?record=new`(새 기록), `?record=<id>`(수정).
 * - 휴대폰의 뒤로 가기로 시트가 닫힌다.
 * - 다른 화면에서 이 주소로 바로 열 수 있다 (홈 빠른 기록, 타임라인).
 * - 닫으면 열기 전 화면으로 돌아간다 (기능요구사항서 2.3: 저장·취소 후에는 진입했던 화면으로).
 */
export function useSheetParam(name = 'record') {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()

  return {
    /** 'new', 기록 id, 또는 닫혀 있으면 null */
    value: params.get(name),
    /** replace: 열려 있는 시트를 다른 기록으로 바꿀 때 (닫으면 시트를 열기 전 화면으로 돌아가게) */
    open(value: string, { replace = false }: { replace?: boolean } = {}) {
      const next = new URLSearchParams(params)
      next.set(name, value)
      setParams(next, { replace })
    },
    close() {
      // 앱 안에서 이동해 왔으면 뒤로 가고, 이 주소로 바로 들어왔으면(돌아갈 곳 없음) 검색 조건만 지운다
      if (location.key !== 'default') {
        navigate(-1)
        return
      }
      const next = new URLSearchParams(params)
      next.delete(name)
      setParams(next, { replace: true })
    },
  }
}
