import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { toContentKey } from '../../../src/domain/text'
import type { Database } from '../../../src/lib/database.types'
import { createAnonClient, createUserClient, ensureChild, utcDate } from '../supabase'

// milestones 접근 제어, title_key, 제약 조건 (T-18, FR-MS-01~06, BR-03)

type Client = SupabaseClient<Database>
type Insert = Database['public']['Tables']['milestones']['Insert']
let a: { client: Client; userId: string }
let b: { client: Client; userId: string }
let aRowId: string

const clear = (c: Client, id: string) => c.from('milestones').delete().eq('owner_id', id)
const insert = (c: Client, row: Insert) => c.from('milestones').insert(row).select().single()

beforeAll(async () => {
  a = await createUserClient('A')
  b = await createUserClient('B')
  await ensureChild(a.client, a.userId)
  await clear(a.client, a.userId)
  await clear(b.client, b.userId)
  const { data, error } = await insert(a.client, {
    date: '2026-10-12',
    type: 'behavior',
    title: '잡고 서기',
  })
  if (error) throw error
  aRowId = data.id
})

afterAll(async () => {
  await clear(a.client, a.userId)
  await clear(b.client, b.userId)
})

describe('milestones: 본인 데이터와 접근 차단', () => {
  it('B는 A의 기록을 조회·수정·삭제할 수 없다', async () => {
    expect((await b.client.from('milestones').select('*').eq('id', aRowId)).data).toEqual([])
    expect(
      (await b.client.from('milestones').update({ title: '침범' }).eq('id', aRowId).select()).data,
    ).toEqual([])
    expect((await b.client.from('milestones').delete().eq('id', aRowId).select()).data).toEqual([])
  })

  it('로그인하지 않으면 조회 결과가 비어 있다', async () => {
    const { data } = await createAnonClient().from('milestones').select('*')
    expect(data ?? []).toEqual([])
  })
})

describe('milestones: title_key (BR-03)', () => {
  it.each(['  Peek  A  Boo ', '맘마'.normalize('NFD'), '잡고   서기'])(
    'DB의 title_key가 화면 규칙(toContentKey)과 같다: %j',
    async (title) => {
      const { data, error } = await insert(a.client, { date: '2026-10-01', type: 'word', title })
      expect(error).toBeNull()
      expect(data?.title_key).toBe(toContentKey(title))
    },
  )

  it('단어가 아니면 같은 내용도 저장할 수 있고 title_key로 찾을 수 있다', async () => {
    await insert(a.client, { date: '2026-10-13', type: 'behavior', title: ' 잡고  서기' })
    const { data } = await a.client
      .from('milestones')
      .select('id')
      .eq('type', 'behavior')
      .eq('title_key', toContentKey('잡고 서기'))
    expect(data?.length).toBe(2)
  })
})

describe('milestones: 같은 단어는 다시 저장할 수 없다 (FR-MS-06)', () => {
  const update = (id: string, row: Database['public']['Tables']['milestones']['Update']) =>
    a.client.from('milestones').update(row).eq('id', id).select().single()

  it('띄어쓰기·대소문자만 달라도 같은 단어로 거부된다', async () => {
    expect(
      (await insert(a.client, { date: '2026-10-02', type: 'word', title: 'Bye bye' })).error,
    ).toBeNull()
    expect(
      (await insert(a.client, { date: '2026-10-05', type: 'word', title: ' bye  BYE' })).error
        ?.code,
    ).toBe('23505')
  })

  it('같은 단어의 날짜·메모 수정은 되고, 다른 기록을 같은 단어로 바꾸면 거부된다', async () => {
    const { data: word } = await insert(a.client, {
      date: '2026-10-06',
      type: 'word',
      title: '까꿍',
    })
    const { data: other } = await insert(a.client, {
      date: '2026-10-07',
      type: 'word',
      title: '빠이',
    })
    const { data: behavior } = await insert(a.client, {
      date: '2026-10-07',
      type: 'behavior',
      title: '까꿍',
    })
    if (!word || !other || !behavior) throw new Error('기록을 만들지 못했습니다')

    expect((await update(word.id, { date: '2026-10-08', memo: '메모' })).error).toBeNull()
    expect((await update(other.id, { title: '까꿍 ' })).error?.code).toBe('23505')
    expect((await update(behavior.id, { type: 'word' })).error?.code).toBe('23505')
  })

  it('다른 사람의 같은 단어와는 상관없다', async () => {
    await insert(a.client, { date: '2026-10-09', type: 'word', title: '안녕' })
    expect(
      (await insert(b.client, { date: '2026-10-09', type: 'word', title: '안녕' })).error,
    ).toBeNull()
  })
})

describe('milestones: 입력값 검증', () => {
  it('정해진 유형만 허용된다', async () => {
    expect(
      (await insert(a.client, { date: '2026-10-01', type: 'food', title: '사과' })).error?.code,
    ).toBe('23514')
  })

  it('내용이 비었거나 30자를 넘으면 거부된다', async () => {
    expect(
      (await insert(a.client, { date: '2026-10-01', type: 'word', title: '  ' })).error?.code,
    ).toBe('23514')
    expect(
      (await insert(a.client, { date: '2026-10-01', type: 'word', title: '가'.repeat(31) })).error
        ?.code,
    ).toBe('23514')
  })

  it('생년월일 이전 날짜와 미래 날짜는 거부된다', async () => {
    expect(
      (await insert(a.client, { date: '2026-01-07', type: 'word', title: '엄마' })).error?.code,
    ).toBe('22007')
    expect(
      (await insert(a.client, { date: utcDate(2), type: 'word', title: '엄마' })).error?.code,
    ).toBe('22007')
  })
})
