/** 화면 전체를 쓰는 불러오는 중 표시 (로그인 상태·아이 정보 확인 중) */
export function FullScreenLoading() {
  return (
    <div role="status" className="flex min-h-dvh items-center justify-center text-muted-foreground">
      불러오는 중…
    </div>
  )
}
