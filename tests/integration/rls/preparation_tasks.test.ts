import { afterAll, beforeAll, expect, it } from 'vitest'
import { createAnonClient, createUserClient } from '../supabase'
let a: Awaited<ReturnType<typeof createUserClient>>, b: typeof a
const created: string[] = []
beforeAll(async () => {
  if (!process.env.VITE_SUPABASE_URL?.includes('mahhdygzpzqvfklxvqed.supabase.co'))
    throw new Error('할 일 검증은 dev에서만 실행합니다')
  a = await createUserClient('A')
  b = await createUserClient('B')
})
afterAll(async () => {
  if (a && created.length) await a.client.from('preparation_tasks').delete().in('id', created)
  await a?.client.auth.signOut({ scope: 'local' })
  await b?.client.auth.signOut({ scope: 'local' })
})
async function add(values: Record<string, unknown> = {}) {
  const result = await a.client
    .from('preparation_tasks')
    .insert({ name: '검증 문화센터 등록', ...values })
    .select()
    .single()
  if (result.data) created.push(result.data.id)
  return result
}
it('완료·되돌리기·내용 수정을 해도 마감일과 링크를 보존한다', async () => {
  const first = await add({ due_date: '2027-01-01', url: 'https://example.com/class' })
  expect(first.error).toBeNull()
  for (const completed of [true, false]) {
    const response = await a.client
      .from('preparation_tasks')
      .update({ completed })
      .eq('id', first.data!.id)
      .select()
      .single()
    expect(response.error).toBeNull()
    expect(response.data).toMatchObject({
      completed,
      due_date: '2027-01-01',
      url: 'https://example.com/class',
    })
  }
})
it('다른 계정·비로그인은 조회·수정·삭제할 수 없고 소유자 위조를 거부한다', async () => {
  const { data } = await add()
  for (const client of [b.client, createAnonClient()])
    expect((await client.from('preparation_tasks').select('*').eq('id', data!.id)).data).toEqual([])
  expect(
    (
      await b.client
        .from('preparation_tasks')
        .update({ completed: true })
        .eq('id', data!.id)
        .select()
    ).data,
  ).toEqual([])
  expect(
    (await b.client.from('preparation_tasks').delete().eq('id', data!.id).select()).data,
  ).toEqual([])
  expect(
    (await b.client.from('preparation_tasks').insert({ name: '위조', owner_id: a.userId })).error
      ?.code,
  ).toBe('42501')
  expect(
    (await a.client.from('preparation_tasks').update({ owner_id: b.userId }).eq('id', data!.id))
      .error?.code,
  ).toBe('42501')
})
it.each([
  { name: ' ' },
  { name: '가'.repeat(81) },
  { memo: '가'.repeat(501) },
  { url: 'javascript:alert(1)' },
  { url: 'https://user:pass@example.com' },
])('DB가 잘못된 입력을 거부한다: %j', async (values) =>
  expect((await add(values)).error?.code).toBe('23514'),
)
