import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createAnonClient, createUserClient } from '../supabase'
import type { Database } from '../../../src/lib/database.types'
type Args = Database['public']['Functions']['save_recipe']['Args']
let a: Awaited<ReturnType<typeof createUserClient>>
let b: Awaited<ReturnType<typeof createUserClient>>
const ids: string[] = []
const foodIds: { id: string; user: 'A' | 'B' }[] = []
const photos: { id: string; user: 'A' | 'B' }[] = []
beforeAll(async () => {
  a = await createUserClient('A')
  b = await createUserClient('B')
})
afterEach(async () => {
  for (const user of [a, b])
    for (const id of ids) {
      const { error } = await user.client.from('recipes').delete().eq('id', id)
      if (error) throw error
    }
  for (const f of foodIds)
    await (f.user === 'A' ? a : b).client.from('foods').delete().eq('id', f.id)
  for (const p of photos)
    await (p.user === 'A' ? a : b).client.from('photos').delete().eq('id', p.id)
  ids.length = 0
  foodIds.length = 0
  photos.length = 0
})
function input(change: Partial<Args> = {}): Args {
  const id = change.id ?? crypto.randomUUID()
  ids.push(id)
  return {
    id,
    name: '검증 레시피',
    ingredients: [{ food_id: null, name: '물', amount: '30ml' }],
    steps: ['끓여요'],
    create_new: true,
    ...change,
  }
}
async function read(id: string) {
  return (await a.client.from('recipes').select('*,recipe_ingredients(*)').eq('id', id).single())
    .data!
}
async function food(user: 'A' | 'B') {
  const owner = user === 'A' ? a : b
  const { data, error } = await owner.client.rpc('add_food', {
    name: '검증' + crypto.randomUUID().slice(0, 8),
    food_group: 'grain',
  })
  if (error) throw error
  foodIds.push({ id: data.id, user })
  return data
}
async function photo(user: 'A' | 'B') {
  const owner = user === 'A' ? a : b
  const id = crypto.randomUUID()
  const { error } = await owner.client
    .from('photos')
    .insert({ id, storage_path: `${owner.userId}/${id}.jpg` })
  if (error) throw error
  photos.push({ id, user })
  return id
}
describe('레시피 편집 트랜잭션 (T-50)', () => {
  it('한 번에 재료·순서·사진을 저장하고 음식의 현재 이름을 사용한다', async () => {
    const f = await food('A')
    const p = await photo('A')
    const args = input({
      name: '  검증 죽  ',
      photo_id: p,
      servings: ' 2회분 ',
      note: ' 참고 ',
      ingredients: [
        { food_id: f.id, name: '이전 이름', amount: '20g' },
        { food_id: null, name: ' 물 ', amount: ' ' },
      ],
      steps: ['씻어요', '끓여요'],
    })
    expect((await a.client.rpc('save_recipe', args)).error).toBeNull()
    const saved = await read(args.id)
    expect(saved).toMatchObject({
      name: '검증 죽',
      photo_id: p,
      servings: '2회분',
      note: '참고',
      steps: ['씻어요', '끓여요'],
    })
    expect(
      saved.recipe_ingredients
        .sort((x, y) => x.position - y.position)
        .map((i) => [i.name, i.amount, i.position]),
    ).toEqual([
      [f.name, '20g', 0],
      ['물', null, 1],
    ])
    expect(
      (await a.client.from('foods').select('status,first_tried_date').eq('id', f.id).single()).data,
    ).toEqual({ status: 'not_tried', first_tried_date: null })
  })
  it('같은 ID 재시도는 중복 생성하지 않고 재료를 통째로 교체한다', async () => {
    const args = input()
    expect((await a.client.rpc('save_recipe', args)).error).toBeNull()
    expect(
      (await a.client.rpc('save_recipe', { ...args, ingredients: [{ name: '쌀', amount: '10g' }] }))
        .error,
    ).toBeNull()
    expect((await read(args.id)).recipe_ingredients.map((i) => i.name)).toEqual(['쌀'])
    const other = input()
    expect((await a.client.rpc('save_recipe', other)).error).toBeNull()
    expect(other.id).not.toBe(args.id)
  })
  it.each([
    { ingredients: [] },
    { ingredients: {} },
    { ingredients: [null] },
    { ingredients: [{ name: '' }] },
    { ingredients: [{ name: '물', amount: 1 }] },
    { ingredients: [{ name: '물', amount: '가'.repeat(21) }] },
    { steps: [] },
    { steps: [''] },
    { name: '가'.repeat(31) },
  ])('유효하지 않은 수정은 기존 레시피·재료를 그대로 둔다: %j', async (invalid) => {
    const args = input()
    expect((await a.client.rpc('save_recipe', args)).error).toBeNull()
    const before = await read(args.id)
    expect((await a.client.rpc('save_recipe', { ...args, ...invalid })).error).not.toBeNull()
    expect(await read(args.id)).toEqual(before)
  })
  it('타인 음식·사진 연결 실패도 재료 삭제까지 모두 롤백한다', async () => {
    const args = input()
    await a.client.rpc('save_recipe', args)
    const before = await read(args.id)
    const f = await food('B')
    const p = await photo('B')
    expect(
      (
        await a.client.rpc('save_recipe', {
          ...args,
          ingredients: [{ name: '변조', food_id: f.id }],
        })
      ).error?.code,
    ).toBe('23503')
    expect((await a.client.rpc('save_recipe', { ...args, photo_id: p })).error?.code).toBe('23503')
    expect(await read(args.id)).toEqual(before)
  })
  it('타인 레시피 수정·비로그인 저장을 거부한다', async () => {
    const args = input()
    await a.client.rpc('save_recipe', args)
    expect((await b.client.rpc('save_recipe', { ...args, name: '변조' })).error?.code).toBe('42501')
    expect((await createAnonClient().rpc('save_recipe', args)).error).not.toBeNull()
    expect((await read(args.id)).name).toBe(args.name)
  })
  it('삭제된 레시피 수정 요청은 다시 생성하지 않는다', async () => {
    const args = input({ create_new: false })
    expect((await a.client.rpc('save_recipe', args)).error?.code).toBe('P0002')
    expect((await a.client.from('recipes').select('id').eq('id', args.id)).data).toEqual([])
  })
})
