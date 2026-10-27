/** 목록을 불러오는 동안 목록 자리에 보여 주는 표시 (FR-COM-22) */
export function ListLoading({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" className="flex flex-col gap-3">
      <span className="sr-only">불러오는 중…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} aria-hidden className="h-18 animate-pulse rounded-card bg-muted" />
      ))}
    </div>
  )
}
