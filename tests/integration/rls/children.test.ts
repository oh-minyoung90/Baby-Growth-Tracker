import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '../../../src/lib/database.types'
import { createAnonClient, createUserClient, utcDate } from '../supabase'

// children 테이블 접근 제어(RLS)와 제약 조건 테스트 (기술요구사항서 6.1, 9.4)
// 테스트 계정 A·B의 children 데이터만 만들고 지운다.

type Client = SupabaseClient<Database>

let a: { client: Client; userId: string }
let b: { client: Client; userId: string }
let aChildId: string

async function clearOwnChild(client: Client, userId: string) {
  const { error } = await client.from('children').delete().eq('owner_id', userId)
  if (error) throw error
}

beforeAll(async () => {
  a = await createUserClient('A')
  b = await createUserClient('B')
  await clearOwnChild(a.client, a.userId)
  await clearOwnChild(b.client, b.userId)

  const { data, error } = await a.client
    .from('children')
    .insert({ nickname: '테스트아기A', birth_date: '2026-01-08' })
    .select()
    .single()
  if (error) throw error
  aChildId = data.id
})

afterAll(async () => {
  await clearOwnChild(a.client, a.userId)
  await clearOwnChild(b.client, b.userId)
})

describe('children: 본인 데이터', () => {
  it('A는 자신의 아이 정보를 조회할 수 있다', async () => {
    const { data, error } = await a.client.from('children').select('*')
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data?.[0]).toMatchObject({ id: aChildId, owner_id: a.userId, nickname: '테스트아기A' })
  })

  it('owner_id를 넣지 않아도 로그인한 사용자로 저장된다', async () => {
    const { data } = await a.client.from('children').select('owner_id').eq('id', aChildId).single()
    expect(data?.owner_id).toBe(a.userId)
  })

  it('계정당 아이 정보는 1건만 저장된다 (FR-CHILD-04)', async () => {
    const { error } = await a.client
      .from('children')
      .insert({ nickname: '두번째', birth_date: '2026-02-01' })
    expect(error?.code).toBe('23505') // unique 위반
  })

  it('수정하면 updated_at이 갱신된다', async () => {
    const before = await a.client.from('children').select('updated_at').eq('id', aChildId).single()
    const { data, error } = await a.client
      .from('children')
      .update({ nickname: '바뀐이름' })
      .eq('id', aChildId)
      .select('updated_at')
      .single()
    expect(error).toBeNull()
    expect(new Date(data!.updated_at).getTime()).toBeGreaterThan(
      new Date(before.data!.updated_at).getTime(),
    )
  })
})

describe('children: 다른 사용자(B)의 접근 차단', () => {
  it('B는 A의 아이 정보를 조회할 수 없다', async () => {
    const { data, error } = await b.client.from('children').select('*').eq('id', aChildId)
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('B는 A의 아이 정보를 수정할 수 없다', async () => {
    const { data } = await b.client
      .from('children')
      .update({ nickname: '침범' })
      .eq('id', aChildId)
      .select()
    expect(data).toEqual([])
    const check = await a.client.from('children').select('nickname').eq('id', aChildId).single()
    expect(check.data?.nickname).not.toBe('침범')
  })

  it('B는 A의 아이 정보를 삭제할 수 없다', async () => {
    const { data } = await b.client.from('children').delete().eq('id', aChildId).select()
    expect(data).toEqual([])
    const check = await a.client.from('children').select('id').eq('id', aChildId)
    expect(check.data).toHaveLength(1)
  })

  it('B는 owner_id를 A로 지정해 데이터를 넣을 수 없다', async () => {
    const { error } = await b.client
      .from('children')
      .insert({ owner_id: a.userId, nickname: '사칭', birth_date: '2026-01-01' })
    expect(error?.code).toBe('42501') // RLS 정책 위반
  })
})

describe('children: 로그인하지 않은 요청 차단', () => {
  const anon = createAnonClient()

  it('조회 결과가 비어 있다', async () => {
    const { data } = await anon.from('children').select('*')
    expect(data ?? []).toEqual([])
  })

  it('추가할 수 없다', async () => {
    const { error } = await anon
      .from('children')
      .insert({ owner_id: a.userId, nickname: '익명', birth_date: '2026-01-01' })
    expect(error).not.toBeNull()
  })
})

describe('children: 입력값 검증', () => {
  it('미래 생년월일은 거부된다 (현재 UTC 날짜 + 2일)', async () => {
    const { error } = await a.client
      .from('children')
      .update({ birth_date: utcDate(2) })
      .eq('id', aChildId)
    expect(error?.code).toBe('22007')
  })

  it('이름이 비어 있으면 거부된다', async () => {
    const { error } = await a.client.from('children').update({ nickname: '   ' }).eq('id', aChildId)
    expect(error?.code).toBe('23514') // check 위반
  })

  it('이름이 20자를 넘으면 거부된다', async () => {
    const { error } = await a.client
      .from('children')
      .update({ nickname: '가'.repeat(21) })
      .eq('id', aChildId)
    expect(error?.code).toBe('23514')
  })
})
