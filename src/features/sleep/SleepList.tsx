import type { LucideIcon } from 'lucide-react'
import { Moon, Sun } from 'lucide-react'
import { Link } from 'react-router'
import { formatDateLabel } from '@/domain/date'
import { formatNapSleep, formatNightSleep, formatTotalSleep } from '@/domain/sleep'
import type { SleepLog } from '@/lib/sleepApi'
import { summarizeSleepLog } from '@/lib/sleepSummary'
import { cn } from '@/lib/utils'

/** 수면 목록, 수면일 최신순 (FR-SLEEP-09). 누르면 그 기록의 수정 화면이 열린다 (FR-COM-30) */
export function SleepList({ logs }: { logs: readonly SleepLog[] }) {
  return (
    <ul aria-label="수면 기록" className="flex flex-col gap-2.5">
      {logs.map((log) => (
        <li key={log.id}>
          <SleepRow log={log} />
        </li>
      ))}
    </ul>
  )
}

/**
 * 한 줄: 수면일, 밤잠과 낮잠(횟수 · 합계), 총 수면 (시안 D-05).
 * 잠든·일어난 시간 중 하나만 있으면 밤잠과 총 수면은 "계산 불가" (FR-SLEEP-06, BR-07)
 */
function SleepRow({ log }: { log: SleepLog }) {
  // 계산할 수 없으면(null) 모두 "계산 불가"
  const result = summarizeSleepLog(log)
  const total = result ? result.totalMinutes : null

  return (
    <Link
      to={`/sleep/${log.id}`}
      className="flex items-center gap-3 rounded-2xl border bg-surface px-4 py-3.5 transition-colors outline-none hover:bg-muted focus-visible:bg-muted md:px-[18px]"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <strong className="text-[15px]">{formatDateLabel(log.date)}</strong>
        {/* 모바일은 밤잠·낮잠을 두 줄로, PC는 한 줄에 세로선으로 나눈다 */}
        <span className="flex flex-col gap-1 md:flex-row md:items-center md:gap-3">
          <SleepPart
            icon={Moon}
            label="밤잠"
            value={result ? formatNightSleep(result) : '계산 불가'}
            known={result?.nightMinutes != null}
          />
          {/* 화면에는 보이지 않는 공백. 화면 낭독기가 "30분낮잠"처럼 붙여 읽지 않게 한다 */}{' '}
          <span aria-hidden className="hidden h-3.5 w-px bg-border md:block" />{' '}
          <SleepPart
            icon={Sun}
            label="낮잠"
            value={result ? formatNapSleep(result) : '계산 불가'}
            known={Boolean(result && result.naps.length > 0)}
          />
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="text-xs text-muted-foreground">총 수면</span>
        <strong className={cn('text-[17px]', total === null && 'text-muted-foreground')}>
          {formatTotalSleep(total)}
        </strong>
      </span>
    </Link>
  )
}

/** 아이콘 + 이름(흐린 글자) + 값. 시간이 없으면("없음", "계산 불가") 값도 흐리게 */
function SleepPart({
  icon: Icon,
  label,
  value,
  known,
}: {
  icon: LucideIcon
  label: string
  value: string
  known: boolean
}) {
  return (
    <span className="flex items-center gap-1.5 text-[13px] md:text-sm">
      <Icon className="size-3.5 shrink-0 text-soft-text" aria-hidden />
      <span className="text-muted-foreground">{label}</span>{' '}
      <span className={cn('font-medium', !known && 'font-normal text-muted-foreground')}>
        {value}
      </span>
    </span>
  )
}
