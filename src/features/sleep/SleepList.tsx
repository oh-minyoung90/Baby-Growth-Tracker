import { Link } from 'react-router'
import { formatDateLabel } from '@/domain/date'
import { formatDuration, formatNightSleep, formatTotalSleep } from '@/domain/sleep'
import type { SleepLog } from '@/lib/sleepApi'
import { cn } from '@/lib/utils'
import { calculateSleepValues, toSleepFormValues } from './sleepSchema'

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
 * 한 줄: 수면일, 밤잠 · 낮잠 횟수와 합계, 총 수면 (시안 D-05).
 * 잠든·일어난 시간 중 하나만 있으면 밤잠과 총 수면은 "계산 불가" (FR-SLEEP-06, BR-07)
 */
function SleepRow({ log }: { log: SleepLog }) {
  // 입력 화면과 같은 규칙(BR-05~07)으로 계산한다. 계산할 수 없으면(null) 모두 "계산 불가"
  const result = calculateSleepValues(toSleepFormValues(log))
  const night = result ? formatNightSleep(result) : '계산 불가'
  const naps = !result
    ? '계산 불가'
    : result.naps.length > 0
      ? `${result.naps.length}회 ${formatDuration(result.napMinutes)}`
      : '없음'
  const total = result ? result.totalMinutes : null

  return (
    <Link
      to={`/sleep/${log.id}`}
      className="flex items-center gap-3 rounded-2xl border bg-surface px-4 py-3.5 transition-colors outline-none hover:bg-muted focus-visible:bg-muted md:px-[18px]"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <strong className="text-[15px]">{formatDateLabel(log.date)}</strong>
        {/* 좁은 화면에서는 "1시간 / 35분"처럼 시간 중간이 아니라 밤잠·낮잠 사이에서 줄을 바꾼다 */}
        <span className="text-[13px] text-muted-foreground md:text-sm">
          <span className="whitespace-nowrap">밤잠 {night}</span> ·{' '}
          <span className="whitespace-nowrap">낮잠 {naps}</span>
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
