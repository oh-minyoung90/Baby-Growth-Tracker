import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createAnonClient, createUserClient } from '../supabase'
let a: Awaited<ReturnType<typeof createUserClient>>, b: typeof a
const created: string[] = []
beforeAll(async () => {
  if (!process.env.VITE_SUPABASE_URL?.includes('mahhdygzpzqvfklxvqed.supabase.co'))
    throw new Error('쇼핑 통합 검사는 dev에서만 실행합니다')
  a = await createUserClient('A')
  b = await createUserClient('B')
})
afterAll(async () => {
  if (a && created.length) await a.client.from('shopping_items').delete().in('id', created)
  await a?.client.auth.signOut()
  await b?.client.auth.signOut()
})
async function add(values: Record<string, unknown> = {}) {
  const result = await a.client
    .from('shopping_items')
    .insert({ name: '쇼핑검증 그림책', category: 'books', ...values })
    .select()
    .single()
  if (result.data) created.push(result.data.id)
  return result
}
describe('쇼핑 RLS·제약·구매 흐름', () => {
  it('구매 체크·되돌리기·다시 담기를 해도 링크와 보관 설정을 유지한다', async () => {
    const first = await add({
      url: 'https://example.com/books',
      is_frequent: true,
      status: 'saved',
    })
    expect(first.error).toBeNull()
    for (const status of ['pending', 'purchased', 'pending'] as const) {
      const r = await a.client
        .from('shopping_items')
        .update({ status })
        .eq('id', first.data!.id)
        .select()
        .single()
      expect(r.error).toBeNull()
      expect(r.data).toMatchObject({ status, url: 'https://example.com/books', is_frequent: true })
    }
  })
  it('B·비로그인은 A 목록을 읽거나 수정·삭제하지 못하고 owner 위조도 거부한다', async () => {
    const { data } = await add()
    for (const client of [b.client, createAnonClient()])
      expect((await client.from('shopping_items').select('*').eq('id', data!.id)).data).toEqual([])
    expect(
      (await b.client.from('shopping_items').update({ name: '침범' }).eq('id', data!.id).select())
        .data,
    ).toEqual([])
    expect(
      (await b.client.from('shopping_items').delete().eq('id', data!.id).select()).data,
    ).toEqual([])
    expect(
      (await b.client.from('shopping_items').insert({ name: '위조', owner_id: a.userId })).error
        ?.code,
    ).toBe('42501')
    expect(
      (await a.client.from('shopping_items').update({ owner_id: b.userId }).eq('id', data!.id))
        .error?.code,
    ).toBe('42501')
  })
  it.each([
    { name: ' ' },
    { name: '가'.repeat(81) },
    { category: 'unknown' },
    { status: 'unknown' },
    { memo: '가'.repeat(501) },
    { url: 'javascript:alert(1)' },
    { url: 'data:text/html,test' },
    { url: 'https://user:pass@example.com' },
    { url: 'https://example.com/a b' },
    { url: 'https://example.com/' + 'a'.repeat(2048) },
    { status: 'saved', is_frequent: false },
  ])('잘못된 입력을 DB에서도 거부한다: %j', async (values) =>
    expect((await add(values)).error?.code).toBe('23514'),
  )
  it('빈 링크와 URL의 쿼리·해시는 허용한다', async () =>
    expect((await add({ url: 'https://example.com/book?a=1#detail' })).error).toBeNull())
})
