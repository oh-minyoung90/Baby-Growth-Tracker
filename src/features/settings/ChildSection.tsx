import { ChevronRight, Sprout } from 'lucide-react'
import { Link } from 'react-router'
import { calculateAge, formatAge } from '@/domain/age'
import { formatDateLabel, todayString } from '@/domain/date'
import { useChild } from '@/lib/useChild'

/** 설정 > 아이 정보 (누르면 수정 화면) */
export function ChildSection() {
  const { data: child } = useChild()
  if (!child) return null
  const age = formatAge(calculateAge(child.birthDate, todayString()))

  return (
    <section aria-labelledby="settings-child" className="flex flex-col gap-2">
      <h2 id="settings-child" className="text-[13px] font-bold text-muted-foreground">
        아이 정보
      </h2>
      <Link
        to="/settings/child"
        aria-label={`아이 정보 수정: ${child.nickname}`}
        className="flex items-center gap-3 rounded-[18px] border bg-card px-4 py-3.5 hover:bg-muted"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-button bg-soft text-soft-text">
          <Sprout className="size-5.5" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <strong className="truncate text-base">{child.nickname}</strong>
          <span className="text-[13px] text-muted-foreground">
            {formatDateLabel(child.birthDate)} 출생 · {age}
          </span>
        </span>
        <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
      </Link>
    </section>
  )
}
