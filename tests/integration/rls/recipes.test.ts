import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { Database, Json } from '../../../src/lib/database.types'
import { createAnonClient, createUserClient, ensureChild } from '../supabase'
type Client = SupabaseClient<Database>
type RecipeInput = Database['public']['Tables']['recipes']['Insert']
let a: Awaited<ReturnType<typeof createUserClient>>
let b: Awaited<ReturnType<typeof createUserClient>>
const created: {
  client: Client
  table: 'recipes' | 'photos' | 'foods' | 'meal_entries'
  id: string
}[] = []
beforeAll(async () => {
  a = await createUserClient('A')
  b = await createUserClient('B')
  await ensureChild(a.client, a.userId)
})
afterEach(async () => {
  for (const table of ['meal_entries', 'recipes', 'photos', 'foods'] as const) {
    for (const row of created.filter((row) => row.table === table)) {
      const { error } =
        table === 'meal_entries'
          ? await row.client.rpc('delete_meal_entry', { id: row.id })
          : await row.client.from(table).delete().eq('id', row.id)
      if (error) throw error
    }
  }
  created.length = 0
})
async function recipe(input: Partial<RecipeInput> = {}, client = a.client) {
  const { data, error } = await client
    .from('recipes')
    .insert({ name: '검증 쌀죽', steps: ['쌀을 씻어요', '끓여요'], ...input })
    .select()
    .single()
  if (error) throw error
  created.push({ client, table: 'recipes', id: data.id })
  return data
}
async function photo(user = a) {
  const id = crypto.randomUUID()
  const { data, error } = await user.client
    .from('photos')
    .insert({ id, storage_path: `${user.userId}/${id}.jpg` })
    .select()
    .single()
  if (error) throw error
  created.push({ client: user.client, table: 'photos', id })
  return data
}
async function food(client = a.client) {
  const { data, error } = await client.rpc('add_food', {
    name: '검증 재료' + crypto.randomUUID().slice(0, 6),
    food_group: 'grain',
  })
  if (error) throw error
  created.push({ client, table: 'foods', id: data.id })
  return data
}
async function meal(recipes: Json, foods: Json = []) {
  const { data, error } = await a.client.rpc('save_meal_entry', {
    date: '2026-10-20',
    meal_type: 'snack',
    eaten: true,
    recipes,
    foods,
  })
  if (error) throw error
  const id = (data as { id: string }).id
  created.push({ client: a.client, table: 'meal_entries', id })
  return id
}

describe('레시피 DB·소유권 (T-47)', () => {
  it('같은 이름 레시피를 허용하고 순서·사진·공통 필드를 저장한다', async () => {
    const p = await photo()
    const first = await recipe({ photo_id: p.id, servings: '2회분', note: '검증 참고' })
    const second = await recipe()
    expect(second.id).not.toBe(first.id)
    expect(first).toMatchObject({
      owner_id: a.userId,
      photo_id: p.id,
      steps: ['쌀을 씻어요', '끓여요'],
      servings: '2회분',
    })
    expect(first.created_at).toBeTruthy()
    expect(first.updated_at).toBeTruthy()
  })
  it.each([
    { name: '' },
    { name: '   ' },
    { name: '가'.repeat(31) },
    { servings: '가'.repeat(21) },
    { note: '가'.repeat(501) },
    { steps: [] },
    { steps: {} },
    { steps: [''] },
    { steps: ['   '] },
    { steps: [1] },
    { steps: ['정상', null] },
  ])('유효하지 않은 이름·완성량·참고·조리 순서를 거부한다: %j', async (input) => {
    const { error } = await a.client
      .from('recipes')
      .insert({ name: '검증', steps: ['끓여요'], ...input })
    expect(error?.code).toBe('23514')
  })
  it('본인 사진·레시피·재료만 읽고 고치고 지울 수 있다', async () => {
    const p = await photo()
    const r = await recipe({ photo_id: p.id })
    const f = await food()
    const inserted = await a.client
      .from('recipe_ingredients')
      .insert({ recipe_id: r.id, food_id: f.id, name: f.name, amount: '30g', position: 0 })
      .select()
      .single()
    expect(inserted.error).toBeNull()
    for (const [table, id] of [
      ['photos', p.id],
      ['recipes', r.id],
      ['recipe_ingredients', inserted.data!.id],
    ] as const) {
      expect((await b.client.from(table).select('*').eq('id', id)).data).toEqual([])
      expect((await b.client.from(table).delete().eq('id', id).select()).data).toEqual([])
      expect((await createAnonClient().from(table).select('*').eq('id', id)).data ?? []).toEqual([])
    }
    expect(
      (await b.client.from('recipes').update({ name: '변조' }).eq('id', r.id).select()).data,
    ).toEqual([])
    expect(
      (
        await b.client
          .from('recipe_ingredients')
          .update({ name: '변조' })
          .eq('id', inserted.data!.id)
          .select()
      ).data,
    ).toEqual([])
    expect((await a.client.from('recipes').select('name').eq('id', r.id).single()).data?.name).toBe(
      r.name,
    )
  })
  it('다른 계정 소유로 행을 만들거나 본인 행의 소유자를 바꿀 수 없다', async () => {
    const r = await recipe()
    const id = crypto.randomUUID()
    expect(
      (await b.client.from('recipes').insert({ owner_id: a.userId, name: '침범', steps: ['단계'] }))
        .error?.code,
    ).toBe('42501')
    expect(
      (
        await b.client
          .from('photos')
          .insert({ id, owner_id: a.userId, storage_path: `${a.userId}/${id}.jpg` })
      ).error?.code,
    ).toBe('42501')
    expect(
      (await a.client.from('recipes').update({ owner_id: b.userId }).eq('id', r.id)).error?.code,
    ).toBe('42501')
    expect(
      (
        await createAnonClient()
          .from('recipes')
          .insert({ name: '비로그인', steps: ['단계'] })
      ).error?.code,
    ).toBe('42501')
  })
  it('타인의 사진·음식·레시피를 연결할 수 없다', async () => {
    const p = await photo(b)
    const r = await recipe()
    const other = await recipe({}, b.client)
    const f = await food(b.client)
    expect(
      (await a.client.from('recipes').update({ photo_id: p.id }).eq('id', r.id)).error?.code,
    ).toBe('23503')
    expect(
      (
        await a.client
          .from('recipe_ingredients')
          .insert({ recipe_id: r.id, food_id: f.id, name: '침범', position: 0 })
      ).error?.code,
    ).toBe('23503')
    expect(
      (
        await a.client
          .from('recipe_ingredients')
          .insert({ recipe_id: other.id, name: '침범', position: 0 })
      ).error?.code,
    ).toBe('23503')
  })
  it('재료 이름·양·순서를 검사하고 같은 순서를 중복 저장하지 않는다', async () => {
    const r = await recipe()
    for (const input of [
      { name: '' },
      { name: '가'.repeat(21) },
      { amount: '가'.repeat(21) },
      { position: -1 },
    ]) {
      expect(
        (
          await a.client
            .from('recipe_ingredients')
            .insert({ recipe_id: r.id, name: '쌀', position: 0, ...input })
        ).error?.code,
      ).toBe('23514')
    }
    expect(
      (
        await a.client
          .from('recipe_ingredients')
          .insert({ recipe_id: r.id, name: '쌀', position: 0 })
      ).error,
    ).toBeNull()
    expect(
      (
        await a.client
          .from('recipe_ingredients')
          .insert({ recipe_id: r.id, name: '보리', position: 0 })
      ).error?.code,
    ).toBe('23505')
  })
  it('음식을 삭제해도 재료 이름·양·순서는 보존하고 레시피 삭제 시 재료는 지운다', async () => {
    const r = await recipe()
    const f = await food()
    await a.client
      .from('recipe_ingredients')
      .insert({ recipe_id: r.id, food_id: f.id, name: '저장한 이름', amount: '30g', position: 0 })
    expect((await a.client.from('foods').delete().eq('id', f.id)).error).toBeNull()
    expect(
      (
        await a.client
          .from('recipe_ingredients')
          .select('food_id,name,amount,position')
          .eq('recipe_id', r.id)
      ).data,
    ).toEqual([{ food_id: null, name: '저장한 이름', amount: '30g', position: 0 }])
    await a.client.from('recipes').delete().eq('id', r.id)
    expect(
      (await a.client.from('recipe_ingredients').select('*').eq('recipe_id', r.id)).data,
    ).toEqual([])
  })
  it('사진 경로는 본인 UUID/사진 UUID.jpg만 허용하고 업로드 후 메타데이터 수정은 막는다', async () => {
    const id = crypto.randomUUID()
    expect(
      (await a.client.from('photos').insert({ id, storage_path: `${b.userId}/${id}.jpg` })).error
        ?.code,
    ).toBe('23514')
    const p = await photo()
    const r = await recipe({ photo_id: p.id })
    expect(
      (await a.client.from('photos').update({ storage_path: p.storage_path }).eq('id', p.id)).error
        ?.code,
    ).toBe('42501')
    await a.client.from('photos').delete().eq('id', p.id)
    expect(
      (await a.client.from('recipes').select('photo_id').eq('id', r.id).single()).data?.photo_id,
    ).toBeNull()
  })
  it('식단에는 본인 레시피만 현재 이름으로 저장하고 삭제 후 이름을 보존한다', async () => {
    const r = await recipe()
    const id = await meal([{ recipe_id: r.id, recipe_name: '변조' }])
    expect(
      (
        await a.client
          .from('meal_entry_recipes')
          .select('recipe_id,recipe_name')
          .eq('meal_entry_id', id)
      ).data,
    ).toEqual([{ recipe_id: r.id, recipe_name: r.name }])
    await a.client.from('recipes').delete().eq('id', r.id)
    expect(
      (
        await a.client
          .from('meal_entry_recipes')
          .select('recipe_id,recipe_name')
          .eq('meal_entry_id', id)
      ).data,
    ).toEqual([{ recipe_id: null, recipe_name: r.name }])
  })
  it('타인 레시피 저장은 칸·직접 음식 상태 변경까지 모두 취소한다', async () => {
    const r = await recipe({}, b.client)
    const f = await food()
    const result = await a.client.rpc('save_meal_entry', {
      date: '2026-10-20',
      meal_type: 'snack',
      eaten: true,
      foods: [{ food_id: f.id }],
      recipes: [{ recipe_id: r.id }],
    })
    expect(result.error?.code).toBe('23503')
    expect(
      (await a.client.from('foods').select('status,first_tried_date').eq('id', f.id).single()).data,
    ).toEqual({ status: 'not_tried', first_tried_date: null })
  })
  it('레시피만 먹은 식단을 만들어도 재료 음식의 상태는 바뀌지 않는다', async () => {
    const r = await recipe()
    const f = await food()
    await a.client
      .from('recipe_ingredients')
      .insert({ recipe_id: r.id, food_id: f.id, name: f.name, position: 0 })
    await meal([{ recipe_id: r.id }])
    expect(
      (await a.client.from('foods').select('status,first_tried_date').eq('id', f.id).single()).data,
    ).toEqual({ status: 'not_tried', first_tried_date: null })
  })
})
