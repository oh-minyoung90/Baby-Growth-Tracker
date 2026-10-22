import { useEffect } from 'react'

/** 브라우저 탭 제목을 화면 이름으로 바꾼다 (화면 읽기 프로그램도 이 제목을 읽는다) */
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · Baby Growth Tracker`
  }, [title])
}
