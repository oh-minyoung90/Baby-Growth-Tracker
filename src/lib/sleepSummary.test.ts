import { describe, expect, it } from 'vitest'
import { summarizeSleepLog } from './sleepSummary'

// 저장된 수면 기록의 합계 (BR-05~07). 테스트 데이터는 가명이다.

describe('summarizeSleepLog', () => {
  it('저장된 시각으로 밤잠·낮잠·총 수면을 계산한다', () => {
    const result = summarizeSleepLog({
      id: 's1',
      date: '2026-10-20',
      bedAt: '2026-10-20T21:00',
      wakeAt: '2026-10-21T06:30',
      naps: [{ startAt: '2026-10-20T10:00', endAt: '2026-10-20T11:00' }],
      memo: null,
    })
    expect(result).toMatchObject({ nightMinutes: 570, napMinutes: 60, totalMinutes: 630 })
  })

  it('자정 넘어 잠든 기록도 수면일 기준으로 계산한다', () => {
    const result = summarizeSleepLog({
      id: 's2',
      date: '2026-10-20',
      bedAt: '2026-10-21T00:30',
      wakeAt: '2026-10-21T08:00',
      naps: [],
      memo: null,
    })
    expect(result).toMatchObject({ nightMinutes: 450, totalMinutes: 450 })
  })

  it('잠든·일어난 시각 중 하나만 있으면 밤잠과 총 수면은 null이다 (FR-SLEEP-06)', () => {
    const result = summarizeSleepLog({
      id: 's3',
      date: '2026-10-20',
      bedAt: '2026-10-20T21:30',
      wakeAt: null,
      naps: [],
      memo: null,
    })
    expect(result).toMatchObject({ nightMinutes: null, totalMinutes: null })
  })

  it('시각 형식이 틀리면 계산하지 않는다', () => {
    const result = summarizeSleepLog({
      id: 's4',
      date: '2026-10-20',
      bedAt: '2026-10-20T2',
      wakeAt: null,
      naps: [],
      memo: null,
    })
    expect(result).toBeNull()
  })
})
