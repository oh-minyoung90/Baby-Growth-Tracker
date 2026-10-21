import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { calculateSleep } from '../../../src/domain/sleep'
import type { Database } from '../../../src/lib/database.types'
import { createAnonClient, createUserClient, ensureChild } from '../supabase'

// sleep_logs 접근 제어와 수면 검증 트리거 (T-24, FR-SLEEP-02~08)

type Client = SupabaseClient<Database>
type Insert = Database['public']['Tables']['sleep_logs']['Insert']
let a: { client: Client; userId: string }
let b: { client: Client; userId: string }
let aRowId: string

const clear = (c: Client, id: string) => c.from('sleep_logs').delete().eq('owner_id', id)
const insert = (c: Client, row: Insert) => c.from('sleep_logs').insert(row).select().single()

beforeAll(async () => {
  a = await createUserClient('A')
  b = await createUserClient('B')
  await ensureChild(a.client, a.userId)
  await clear(a.client, a.userId)
  await clear(b.client, b.userId)

  // 화면 계산 결과(src/domain/sleep.ts)를 그대로 저장할 수 있어야 한다
  const r = calculateSleep({
    sleepDate: '2026-10-13',
    bedTime: '21:30',
    wakeTime: '07:10',
    naps: [
      { start: '10:00', end: '11:20' },
      { start: '14:30', end: '15:40' },
    ],
  })
  const { data, error } = await insert(a.client, {
    date: '2026-10-13',
    bed_time: r.bedAt,
    wake_time: r.wakeAt,
    naps: r.naps.map((n) => ({ start: n.startAt, end: n.endAt })),
  })
  if (error) throw error
  aRowId = data.id
})

afterAll(async () => {
  await clear(a.client, a.userId)
  await clear(b.client, b.userId)
})

describe('sleep_logs: 저장과 접근 차단', () => {
  it('화면에서 계산한 수면 기록이 저장된다', async () => {
    const { data } = await a.client.from('sleep_logs').select('*').eq('id', aRowId).single()
    expect(data?.bed_time?.startsWith('2026-10-13T21:30')).toBe(true)
    expect(data?.wake_time?.startsWith('2026-10-14T07:10')).toBe(true)
    expect(data?.naps).toHaveLength(2)
  })

  it('수면일당 1건만 저장된다', async () => {
    const { error } = await insert(a.client, { date: '2026-10-13', wake_time: '2026-10-14T07:00' })
    expect(error?.code).toBe('23505')
  })

  it('B는 A의 기록을 조회·수정·삭제할 수 없다', async () => {
    expect((await b.client.from('sleep_logs').select('*').eq('id', aRowId)).data).toEqual([])
    expect(
      (await b.client.from('sleep_logs').update({ memo: '침범' }).eq('id', aRowId).select()).data,
    ).toEqual([])
    expect((await b.client.from('sleep_logs').delete().eq('id', aRowId).select()).data).toEqual([])
  })

  it('로그인하지 않으면 조회 결과가 비어 있다', async () => {
    const { data } = await createAnonClient().from('sleep_logs').select('*')
    expect(data ?? []).toEqual([])
  })

  it('일어난 시각만 있어도 저장된다 (FR-SLEEP-06)', async () => {
    expect(
      (await insert(a.client, { date: '2026-10-12', wake_time: '2026-10-13T06:50' })).error,
    ).toBeNull()
  })
})

describe('sleep_logs: 검증 트리거 (FR-SLEEP-07)', () => {
  const rejects = async (row: Insert) =>
    expect((await insert(a.client, row)).error?.code).toBe('23514')

  it('시간 항목이 하나도 없으면 거부', () => rejects({ date: '2026-10-01' }))

  it('잠든 시각이 수면일 정오 이전이면 거부', () =>
    rejects({ date: '2026-10-02', bed_time: '2026-10-02T10:00' }))

  it('잠든 시각이 다음 날 정오 이후면 거부', () =>
    rejects({ date: '2026-10-03', bed_time: '2026-10-04T12:00' }))

  it('밤잠 1시간 미만이면 거부', () =>
    rejects({ date: '2026-10-04', bed_time: '2026-10-04T21:00', wake_time: '2026-10-04T21:30' }))

  it('밤잠 16시간 초과면 거부', () =>
    rejects({ date: '2026-10-05', bed_time: '2026-10-05T13:00', wake_time: '2026-10-06T05:30' }))

  it('낮잠 끝이 시작보다 이르면 거부', () =>
    rejects({ date: '2026-10-06', naps: [{ start: '2026-10-06T14:00', end: '2026-10-06T13:00' }] }))

  it('낮잠이 수면일 당일이 아니면 거부', () =>
    rejects({ date: '2026-10-07', naps: [{ start: '2026-10-08T10:00', end: '2026-10-08T11:00' }] }))

  it('낮잠끼리 겹치면 거부', () =>
    rejects({
      date: '2026-10-08',
      naps: [
        { start: '2026-10-08T10:00', end: '2026-10-08T11:00' },
        { start: '2026-10-08T10:30', end: '2026-10-08T11:30' },
      ],
    }))

  it('낮잠이 밤잠과 겹치면 거부', () =>
    rejects({
      date: '2026-10-09',
      bed_time: '2026-10-09T19:00',
      wake_time: '2026-10-10T07:00',
      naps: [{ start: '2026-10-09T18:30', end: '2026-10-09T19:30' }],
    }))

  it('낮잠에 끝 시각이 없으면 거부', () =>
    rejects({ date: '2026-10-10', naps: [{ start: '2026-10-10T10:00' }] }))
})
