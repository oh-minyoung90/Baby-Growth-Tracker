import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '../../../src/lib/database.types'
import { createAnonClient, createUserClient, ensureChild, utcDate } from '../supabase'

// body_measures 접근 제어와 제약 조건 (T-15, FR-BODY-01~02, BR-02)

type Client = SupabaseClient<Database>
let a: { client: Client; userId: string }
let b: { client: Client; userId: string }
let aRowId: string

const clear = (c: Client, id: string) => c.from('body_measures').delete().eq('owner_id', id)
const insert = (c: Client, row: Database['public']['Tables']['body_measures']['Insert']) =>
  c.from('body_measures').insert(row).select().single()

beforeAll(async () => {
  a = await createUserClient('A')
  b = await createUserClient('B')
  await ensureChild(a.client, a.userId)
  await clear(a.client, a.userId)
  await clear(b.client, b.userId)
  const { data, error } = await insert(a.client, {
    date: '2026-09-30',
    height_cm: 72.1,
    weight_kg: 8.9,
  })
  if (error) throw error
  aRowId = data.id
})

afterAll(async () => {
  await clear(a.client, a.userId)
  await clear(b.client, b.userId)
})

describe('body_measures: 본인 데이터와 접근 차단', () => {
  it('A는 자신의 측정 기록을 조회한다', async () => {
    const { data } = await a.client.from('body_measures').select('*').eq('id', aRowId).single()
    expect(data).toMatchObject({ owner_id: a.userId, height_cm: 72.1, weight_kg: 8.9 })
  })

  it('B는 A의 기록을 조회·수정·삭제할 수 없다', async () => {
    expect((await b.client.from('body_measures').select('*').eq('id', aRowId)).data).toEqual([])
    expect(
      (await b.client.from('body_measures').update({ memo: '침범' }).eq('id', aRowId).select())
        .data,
    ).toEqual([])
    expect((await b.client.from('body_measures').delete().eq('id', aRowId).select()).data).toEqual(
      [],
    )
  })

  it('로그인하지 않으면 조회 결과가 비어 있다', async () => {
    const { data } = await createAnonClient().from('body_measures').select('*')
    expect(data ?? []).toEqual([])
  })
})

describe('body_measures: 입력값 검증', () => {
  it('키 또는 몸무게 하나만 있어도 저장된다', async () => {
    expect((await insert(a.client, { date: '2026-08-31', height_cm: 70.2 })).error).toBeNull()
    expect((await insert(a.client, { date: '2026-08-31', weight_kg: 8.4 })).error).toBeNull()
  })

  it('키와 몸무게가 모두 없으면 거부된다', async () => {
    expect((await insert(a.client, { date: '2026-08-31' })).error?.code).toBe('23514')
  })

  it.each([
    ['키 29.9', { height_cm: 29.9 }],
    ['키 150.1', { height_cm: 150.1 }],
    ['몸무게 0.9', { weight_kg: 0.9 }],
    ['몸무게 50.1', { weight_kg: 50.1 }],
  ])('범위 밖 값은 거부된다: %s', async (_, value) => {
    expect((await insert(a.client, { date: '2026-08-31', ...value })).error?.code).toBe('23514')
  })

  it('범위 경계값은 허용된다', async () => {
    expect(
      (await insert(a.client, { date: '2026-08-31', height_cm: 30, weight_kg: 50 })).error,
    ).toBeNull()
  })

  it('생년월일 이전 날짜와 미래 날짜는 거부된다', async () => {
    expect((await insert(a.client, { date: '2026-01-07', weight_kg: 3 })).error?.code).toBe('22007')
    expect((await insert(a.client, { date: utcDate(2), weight_kg: 9 })).error?.code).toBe('22007')
  })

  it('메모가 500자를 넘으면 거부된다', async () => {
    const { error } = await insert(a.client, {
      date: '2026-08-31',
      weight_kg: 8.4,
      memo: '가'.repeat(501),
    })
    expect(error?.code).toBe('23514')
  })
})
