import { useEffect, useState } from 'react'

/** 목표 시각(ms)까지 남은 초. 목표가 없으면 0. 1초마다 갱신한다 */
export function useCountdown(targetTime: number | null): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (targetTime === null) return
    const tick = () => setNow(Date.now())
    // 목표가 바뀌면(코드 다시 받기) 바로 한 번 갱신하고, 이후 1초마다 갱신한다
    const first = window.setTimeout(tick, 0)
    const id = window.setInterval(tick, 1000)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(id)
    }
  }, [targetTime])

  if (targetTime === null) return 0
  return Math.max(0, Math.ceil((targetTime - now) / 1000))
}

/** 초 → "MM:SS" */
export function formatMmSs(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
