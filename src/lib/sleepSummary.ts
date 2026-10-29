import { calculateSleep, type SleepResult } from '@/domain/sleep'
import type { SleepLog } from '@/lib/sleepApi'

/**
 * 저장된 수면 기록의 밤잠·낮잠·총 수면 (BR-05~07). 수면 목록과 홈이 함께 쓴다.
 * 입력 화면과 같은 규칙으로 보이도록, 저장된 시각에서 시각만 꺼내 다시 계산한다.
 * 시각 형식이 틀려 계산할 수 없으면 null (DB 검증 트리거가 있어 저장된 기록에서는 생기지 않는다)
 */
export function summarizeSleepLog(log: SleepLog): SleepResult | null {
  const time = (value: string | null) => value?.slice(11, 16) ?? null
  try {
    return calculateSleep({
      sleepDate: log.date,
      bedTime: time(log.bedAt),
      wakeTime: time(log.wakeAt),
      naps: log.naps.map((nap) => ({ start: time(nap.startAt), end: time(nap.endAt) })),
    })
  } catch {
    return null
  }
}
