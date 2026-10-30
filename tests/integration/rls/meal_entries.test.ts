import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '../../../src/lib/database.types'
import { createAnonClient, createUserClient, utcDate } from '../supabase'

// meal_entries·meal_entry_foods·meal_entry_recipes 접근 제어, 날짜·끼니당 1건, 미래 "먹음" 거부, 칸에 담긴 음식·레시피
// (T-39, 기술요구사항서 5.3·5.4·6.1, D2, D7, 기능요구사항서 FR-MEAL-03~07, F-15)
// 칸 저장 함수(T-40)가 생기기 전이라 테이블에 직접 쓴다. T-40에서 직접 쓰기를 막으면 함수로 바꾼다

type Client = SupabaseClient<Database>
type EntryInsert = Database['public']['Tables']['meal_entries']['Insert']
type EntryFoodInsert = Database['public']['Tables']['meal_entry_foods']['Insert']
type EntryRecipeInsert = Database['public']['Tables']['meal_entry_recipes']['Insert']
let a: { client: Client; userId: string }
let b: { client: Client; userId: string }
let aEntryId: string
let aFoodId: string

// 칸을 지우면 담긴 음식·레시피도 함께 지워진다
const clear = async (c: Client, id: string) => {
  await c.from('meal_entries').delete().eq('owner_id', id)
  await c.from('foods').delete().eq('owner_id', id)
}
const insertEntry = (c: Client, row: EntryInsert) =>
  c.from('meal_entries').insert(row).select().single()
const addEntryFood = (c: Client, row: EntryFoodInsert) =>
  c.from('meal_entry_foods').insert(row).select().single()
const addEntryRecipe = (c: Client, row: EntryRecipeInsert) =>
  c.from('meal_entry_recipes').insert(row).select().single()
const addFood = async (c: Client, name: string) => {
  const { data, error } = await c.rpc('add_food', { name, food_group: 'grain' })
  if (error) throw error
  return data.id
}

beforeAll(async () => {
  a = await createUserClient('A')
  b = await createUserClient('B')
  await clear(a.client, a.userId)
  await clear(b.client, b.userId)

  aFoodId = await addFood(a.client, '쌀미음')
  const { data, error } = await insertEntry(a.client, {
    date: '2026-10-20',
    meal_type: 'lunch',
    eaten: true,
    intake: 'good',
    memo: '잘 먹음',
  })
  if (error) throw error
  aEntryId = data.id
  const food = await addEntryFood(a.client, {
    meal_entry_id: aEntryId,
    food_id: aFoodId,
    food_name: '쌀미음',
    position: 0,
  })
  if (food.error) throw food.error
})

afterAll(async () => {
  await clear(a.client, a.userId)
  await clear(b.client, b.userId)
})

describe('meal_entries: 본인 데이터와 접근 차단', () => {
  it('B는 A의 칸과 담긴 음식을 조회·수정·삭제할 수 없다', async () => {
    expect((await b.client.from('meal_entries').select('*').eq('id', aEntryId)).data).toEqual([])
    expect(
      (await b.client.from('meal_entries').update({ memo: '침범' }).eq('id', aEntryId).select())
        .data,
    ).toEqual([])
    expect((await b.client.from('meal_entries').delete().eq('id', aEntryId).select()).data).toEqual(
      [],
    )
    expect(
      (await b.client.from('meal_entry_foods').select('*').eq('meal_entry_id', aEntryId)).data,
    ).toEqual([])
    const { data } = await a.client.from('meal_entries').select('memo').eq('id', aEntryId).single()
    expect(data?.memo).toBe('잘 먹음')
  })

  it('로그인하지 않으면 조회 결과가 비어 있고, 칸을 추가할 수 없다', async () => {
    const anon = createAnonClient()
    expect((await anon.from('meal_entries').select('*')).data ?? []).toEqual([])
    expect((await anon.from('meal_entry_foods').select('*')).data ?? []).toEqual([])
    expect((await anon.from('meal_entry_recipes').select('*')).data ?? []).toEqual([])
    const { error } = await anon
      .from('meal_entries')
      .insert({ owner_id: a.userId, date: '2026-10-21', meal_type: 'lunch', eaten: false })
    expect(error?.code).toBe('42501')
  })
})

describe('날짜·끼니당 1건 (FR-MEAL-04, T-39 완료 기준)', () => {
  it('같은 날짜·끼니는 2건 저장할 수 없다', async () => {
    const { error } = await insertEntry(a.client, {
      date: '2026-10-20',
      meal_type: 'lunch',
      eaten: false,
    })
    expect(error?.code).toBe('23505')
  })

  it('다른 끼니나 다른 사람의 같은 날짜·끼니는 저장된다', async () => {
    expect(
      (await insertEntry(a.client, { date: '2026-10-20', meal_type: 'snack', eaten: true })).error,
    ).toBeNull()
    expect(
      (await insertEntry(b.client, { date: '2026-10-20', meal_type: 'lunch', eaten: true })).error,
    ).toBeNull()
  })
})

describe('"먹음" 칸의 날짜 (FR-MEAL-07, D2)', () => {
  it('"먹음" 칸은 미래 날짜를 거부하고, 계획 칸은 미래도 저장된다', async () => {
    expect(
      (await insertEntry(a.client, { date: utcDate(2), meal_type: 'breakfast', eaten: true })).error
        ?.code,
    ).toBe('22007')
    const plan = await insertEntry(a.client, {
      date: utcDate(30),
      meal_type: 'breakfast',
      eaten: false,
    })
    expect(plan.error).toBeNull()
    expect(plan.data).toMatchObject({ eaten: false, intake: null })
  })

  it('미래의 계획 칸을 "먹음"으로 바꾸거나 "먹음" 칸을 미래로 옮기면 거부된다', async () => {
    const plan = await insertEntry(a.client, {
      date: utcDate(10),
      meal_type: 'dinner',
      eaten: false,
    })
    if (plan.error) throw plan.error
    const update = (id: string, row: Database['public']['Tables']['meal_entries']['Update']) =>
      a.client.from('meal_entries').update(row).eq('id', id).select().single()
    expect((await update(plan.data.id, { eaten: true })).error?.code).toBe('22007')
    expect((await update(aEntryId, { date: utcDate(3) })).error?.code).toBe('22007')
    // 날짜·체크를 바꾸지 않는 저장은 검사하지 않는다
    expect((await update(aEntryId, { memo: '반 공기' })).data?.memo).toBe('반 공기')
  })
})

describe('값 제한 (FR-MEAL-05)', () => {
  it('끼니·먹은 정도는 정해진 값만, 메모는 500자까지다', async () => {
    const base = { date: '2026-10-19', eaten: true }
    const codes = await Promise.all([
      insertEntry(a.client, { ...base, meal_type: 'brunch' }),
      insertEntry(a.client, { ...base, meal_type: 'breakfast', intake: 'great' }),
      insertEntry(a.client, { ...base, meal_type: 'dinner', memo: '가'.repeat(501) }),
    ]).then((results) => results.map((r) => r.error?.code))
    expect(codes).toEqual(['23514', '23514', '23514'])
  })
})

describe('칸에 담긴 음식·레시피 (D7)', () => {
  let entryId: string

  beforeAll(async () => {
    const { data, error } = await insertEntry(a.client, {
      date: '2026-10-18',
      meal_type: 'dinner',
      eaten: true,
    })
    if (error) throw error
    entryId = data.id
  })

  it('음식과 레시피를 순서와 함께 담고, 저장할 때의 이름을 남긴다', async () => {
    const broccoliId = await addFood(a.client, '브로콜리')
    expect(
      (
        await addEntryFood(a.client, {
          meal_entry_id: entryId,
          food_id: broccoliId,
          food_name: '브로콜리',
          position: 1,
        })
      ).error,
    ).toBeNull()
    expect(
      (
        await addEntryFood(a.client, {
          meal_entry_id: entryId,
          food_id: aFoodId,
          food_name: '쌀미음',
          position: 0,
        })
      ).error,
    ).toBeNull()
    // 레시피 테이블은 T-47에서 만든다. 지금은 이름만 담는다
    expect(
      (
        await addEntryRecipe(a.client, {
          meal_entry_id: entryId,
          recipe_name: '소고기 브로콜리 죽',
          position: 0,
        })
      ).error,
    ).toBeNull()

    const { data } = await a.client
      .from('meal_entry_foods')
      .select('food_name, position')
      .eq('meal_entry_id', entryId)
      .order('position')
    expect(data).toEqual([
      { food_name: '쌀미음', position: 0 },
      { food_name: '브로콜리', position: 1 },
    ])
  })

  it('한 칸에 같은 음식·같은 순서는 한 번만 담고, 이름 길이를 지킨다', async () => {
    const codes = await Promise.all([
      addEntryFood(a.client, {
        meal_entry_id: entryId,
        food_id: aFoodId,
        food_name: '쌀미음',
        position: 5,
      }),
      addEntryFood(a.client, { meal_entry_id: entryId, food_name: '감자', position: 0 }),
      addEntryFood(a.client, { meal_entry_id: entryId, food_name: '가'.repeat(21), position: 6 }),
      addEntryFood(a.client, { meal_entry_id: entryId, food_name: '  ', position: 7 }),
      addEntryRecipe(a.client, {
        meal_entry_id: entryId,
        recipe_name: '가'.repeat(31),
        position: 1,
      }),
    ]).then((results) => results.map((r) => r.error?.code))
    expect(codes).toEqual(['23505', '23505', '23514', '23514', '23514'])
  })

  it('다른 사람의 칸이나 음식을 가리킬 수 없다', async () => {
    // B가 A의 칸에 음식을 넣으려 함
    expect(
      (await addEntryFood(b.client, { meal_entry_id: entryId, food_name: '침범', position: 9 }))
        .error?.code,
    ).toBe('23503')
    // A가 B의 음식을 자기 칸에 넣으려 함
    const bFoodId = await addFood(b.client, '비밀음식')
    expect(
      (
        await addEntryFood(a.client, {
          meal_entry_id: entryId,
          food_id: bFoodId,
          food_name: '비밀음식',
          position: 9,
        })
      ).error?.code,
    ).toBe('23503')
  })

  it('음식을 지우면 칸에서 연결만 끊기고 이름은 남는다 (FR-FOOD-08)', async () => {
    const carrotId = await addFood(a.client, '당근')
    await addEntryFood(a.client, {
      meal_entry_id: entryId,
      food_id: carrotId,
      food_name: '당근',
      position: 2,
    })
    expect((await a.client.from('foods').delete().eq('id', carrotId)).error).toBeNull()
    const { data } = await a.client
      .from('meal_entry_foods')
      .select('food_id, food_name')
      .eq('meal_entry_id', entryId)
      .eq('position', 2)
      .single()
    expect(data).toEqual({ food_id: null, food_name: '당근' })
  })

  it('칸을 지우면 담긴 음식·레시피도 함께 지워진다', async () => {
    expect((await a.client.from('meal_entries').delete().eq('id', entryId)).error).toBeNull()
    expect(
      (await a.client.from('meal_entry_foods').select('id').eq('meal_entry_id', entryId)).data,
    ).toEqual([])
    expect(
      (await a.client.from('meal_entry_recipes').select('id').eq('meal_entry_id', entryId)).data,
    ).toEqual([])
  })
})
