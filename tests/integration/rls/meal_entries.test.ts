import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Database, Json } from '../../../src/lib/database.types'
import { createAnonClient, createUserClient, ensureChild, utcDate } from '../supabase'

// T-39·T-40: 실제 dev DB에서 식단 함수·RLS·재계산·트랜잭션을 확인한다.
// 테스트 전용 계정 A·B만 사용한다. 직접 쓰기 대신 공개 RPC로 준비·정리한다.
type Client = SupabaseClient<Database>
type SaveArgs = Database['public']['Functions']['save_meal_entry']['Args']
type FoodArgs = Database['public']['Functions']['add_food']['Args']
type MealResult = { id: string; first_tried_foods: { id: string; name: string }[] }
let a: { client: Client; userId: string } | undefined
let b: { client: Client; userId: string } | undefined
const clientA = () => {
  if (!a) throw new Error('테스트 계정 A가 준비되지 않았습니다')
  return a.client
}
const clientB = () => {
  if (!b) throw new Error('테스트 계정 B가 준비되지 않았습니다')
  return b.client
}
const clear = async (client: Client, userId: string) => {
  const entries = await client.from('meal_entries').select('id').eq('owner_id', userId)
  if (entries.error) throw entries.error
  for (const entry of entries.data) {
    const { error } = await client.rpc('delete_meal_entry', { id: entry.id })
    if (error) throw error
  }
  const { error } = await client.from('foods').delete().eq('owner_id', userId)
  if (error) throw error
}
const addFood = async (name = '쌀', args: Partial<FoodArgs> = {}, client = clientA()) => {
  const { data, error } = await client.rpc('add_food', { name, food_group: 'grain', ...args })
  if (error) throw error
  return data.id
}
const save = (foodIds: string[], args: SaveArgs = {}, client = clientA()) =>
  client.rpc('save_meal_entry', {
    date: '2026-10-15',
    meal_type: 'lunch',
    eaten: true,
    foods: foodIds.map((food_id) => ({ food_id })),
    ...args,
  })
const result = (data: Json | null): MealResult => {
  expect(data).toMatchObject({ id: expect.any(String), first_tried_foods: expect.any(Array) })
  return data as unknown as MealResult
}
const meal = async (foodIds: string[], args: SaveArgs = {}, client = clientA()) => {
  const { data, error } = await save(foodIds, args, client)
  if (error) throw error
  return result(data)
}
const food = async (id: string) => {
  const { data, error } = await clientA().from('foods').select('*').eq('id', id).single()
  if (error) throw error
  return data
}
const history = async (id: string) => {
  const { data, error } = await clientA()
    .from('food_status_history')
    .select('*')
    .eq('food_id', id)
    .order('changed_at')
  if (error) throw error
  return data
}
const caution = async (foodId: string, today = '2026-10-10') => {
  const { error } = await clientA().rpc('set_food_caution', {
    food_id: foodId,
    reaction_date: '2026-10-01',
    today,
    symptom_note: '테스트 증상',
    check_note: '테스트 확인',
  })
  if (error) throw error
}
const remove = async (id: string) => {
  const { error } = await clientA().rpc('delete_meal_entry', { id })
  if (error) throw error
}

beforeAll(async () => {
  a = await createUserClient('A')
  b = await createUserClient('B')
  await ensureChild(a.client, a.userId)
})
beforeEach(async () => {
  if (a) await clear(a.client, a.userId)
  if (b) await clear(b.client, b.userId)
})
afterAll(async () => {
  if (a) await clear(a.client, a.userId)
  if (b) await clear(b.client, b.userId)
})

describe('식단 RPC와 접근 제어 (D10)', () => {
  it('다른 계정은 조회할 수 없고 RPC로 수정·체크·삭제할 수 없다', async () => {
    const id = await addFood()
    const entry = await meal([id])
    for (const table of ['meal_entries', 'meal_entry_foods', 'meal_entry_recipes'] as const) {
      expect((await clientB().from(table).select('*')).data).toEqual([])
    }
    expect((await save([id], { id: entry.id }, clientB())).error?.code).toBe('P0002')
    expect(
      (await clientB().rpc('set_meal_eaten', { id: entry.id, eaten: false })).error?.code,
    ).toBe('P0002')
    expect((await clientB().rpc('delete_meal_entry', { id: entry.id })).error?.code).toBe('P0002')
    expect((await food(id)).status).toBe('tried')
  })

  it('로그인하지 않으면 RPC를 호출할 수 없고 조회 결과도 비어 있다', async () => {
    const anon = createAnonClient()
    const id = await addFood()
    const entry = await meal([id])
    expect((await save([id], {}, anon)).error?.code).toBe('42501')
    expect((await anon.rpc('set_meal_eaten', { id: entry.id, eaten: false })).error?.code).toBe(
      '42501',
    )
    expect((await anon.rpc('delete_meal_entry', { id: entry.id })).error?.code).toBe('42501')
    for (const table of ['meal_entries', 'meal_entry_foods', 'meal_entry_recipes'] as const) {
      expect((await anon.from(table).select('*')).data ?? []).toEqual([])
    }
  })

  it('로그인해도 테이블에 직접 추가·수정·삭제하거나 내부 함수를 실행할 수 없다', async () => {
    const id = await addFood()
    const entry = await meal([id])
    const rows = [
      clientA()
        .from('meal_entries')
        .insert({ date: '2026-10-16', meal_type: 'lunch', eaten: true }),
      clientA()
        .from('meal_entry_foods')
        .insert({ meal_entry_id: entry.id, food_name: '침범', position: 9 }),
      clientA()
        .from('meal_entry_recipes')
        .insert({ meal_entry_id: entry.id, recipe_name: '침범', position: 9 }),
      clientA().from('meal_entries').update({ eaten: false }).eq('id', entry.id),
      clientA()
        .from('meal_entry_foods')
        .update({ food_name: '침범' })
        .eq('meal_entry_id', entry.id),
      clientA()
        .from('meal_entry_recipes')
        .update({ recipe_name: '침범' })
        .eq('meal_entry_id', entry.id),
      clientA().from('meal_entries').delete().eq('id', entry.id),
      clientA().from('meal_entry_foods').delete().eq('meal_entry_id', entry.id),
      clientA().from('meal_entry_recipes').delete().eq('meal_entry_id', entry.id),
    ]
    for (const query of rows) expect((await query).error?.code).toBe('42501')
    expect((await clientA().rpc('recalc_food', { food_id: id })).error?.code).toBe('42501')
    expect((await clientA().rpc('recalc_meal_foods', { food_ids: [id] })).error?.code).toBe('42501')
    expect((await food(id)).status).toBe('tried')
  })

  it('다른 계정의 음식을 담으면 전체 저장을 취소한다', async () => {
    const own = await addFood()
    const other = await addFood('비밀음식', {}, clientB())
    expect((await save([own, other])).error?.code).toBe('23503')
    expect((await clientA().from('meal_entries').select('*')).data).toEqual([])
    expect((await food(own)).status).toBe('not_tried')
  })
})

describe('식단 저장·제약·이름 보존 (T-39, D7)', () => {
  it('음식 이름은 DB에서 가져오고 음식·레시피의 배열 순서를 저장한다', async () => {
    const rice = await addFood()
    const carrot = await addFood('당근')
    const entry = await meal([], {
      foods: [{ food_id: carrot, food_name: '변조' }, { food_id: rice }],
      recipes: [{ recipe_name: '소고기죽' }, { recipe_name: '감자전' }],
      memo: '잘 먹음',
      intake: 'good',
    })
    expect(
      (
        await clientA()
          .from('meal_entry_foods')
          .select('food_name, position')
          .eq('meal_entry_id', entry.id)
          .order('position')
      ).data,
    ).toEqual([
      { food_name: '당근', position: 0 },
      { food_name: '쌀', position: 1 },
    ])
    expect(
      (
        await clientA()
          .from('meal_entry_recipes')
          .select('recipe_name, position')
          .eq('meal_entry_id', entry.id)
          .order('position')
      ).data,
    ).toEqual([
      { recipe_name: '소고기죽', position: 0 },
      { recipe_name: '감자전', position: 1 },
    ])
    await remove(entry.id)
    expect((await clientA().from('meal_entry_foods').select('*')).data).toEqual([])
    expect((await clientA().from('meal_entry_recipes').select('*')).data).toEqual([])
  })

  it('음식을 지워도 이름은 남고, 남은 이름으로 칸을 다시 저장할 수 있다', async () => {
    const id = await addFood()
    const entry = await meal([id])
    const deleted = await clientA().from('foods').delete().eq('id', id)
    expect(deleted.error).toBeNull()
    expect(
      (
        await clientA()
          .from('meal_entry_foods')
          .select('food_id, food_name')
          .eq('meal_entry_id', entry.id)
      ).data,
    ).toEqual([{ food_id: null, food_name: '쌀' }])
    expect(
      (await save([], { id: entry.id, foods: [{ food_id: null, food_name: '쌀' }] })).error,
    ).toBeNull()
  })

  it('같은 날짜·끼니와 한 칸의 중복 음식은 거부한다', async () => {
    const id = await addFood()
    await meal([id])
    expect((await save([id])).error?.code).toBe('23505')
    expect((await save([id, id], { meal_type: 'dinner' })).error?.code).toBe('23505')
    expect((await save([id], { meal_type: 'dinner' })).error).toBeNull()
    const other = await addFood('보리', {}, clientB())
    expect((await save([other], {}, clientB())).error).toBeNull()
  })

  it('음식·레시피 없이 저장하거나 배열이 아닌 값을 보낼 수 없다', async () => {
    expect((await save([])).error?.code).toBe('22023')
    expect((await save([], { foods: {} })).error?.code).toBe('22023')
    expect((await save([], { foods: [null] })).error?.code).toBe('22023')
  })

  it('미래 먹음 기록은 거부하지만 계획은 저장하고, 미래 계획의 먹음 체크는 거부한다', async () => {
    const id = await addFood()
    expect((await save([id], { date: utcDate(3) })).error?.code).toBe('22007')
    const entry = await meal([id], { date: utcDate(3), eaten: false })
    expect((await food(id)).status).toBe('not_tried')
    expect((await clientA().rpc('set_meal_eaten', { id: entry.id, eaten: true })).error?.code).toBe(
      '22007',
    )
    expect(
      (await save([id], { id: entry.id, date: utcDate(3), eaten: false, memo: '계획 수정' })).error,
    ).toBeNull()
  })

  it('끼니·섭취량·메모와 이름 길이 제한을 지키고 실패 시 기존 칸을 유지한다', async () => {
    const id = await addFood()
    const entry = await meal([id], { memo: '원래 메모' })
    for (const args of [{ meal_type: 'brunch' }, { intake: 'great' }, { memo: '가'.repeat(501) }]) {
      expect((await save([id], { id: entry.id, ...args })).error?.code).toBe('23514')
    }
    expect(
      (await save([], { id: entry.id, foods: [{ food_name: '가'.repeat(21) }] })).error?.code,
    ).toBe('23514')
    expect(
      (await save([], { id: entry.id, recipes: [{ recipe_name: '가'.repeat(31) }] })).error?.code,
    ).toBe('23514')
    expect(
      (await clientA().from('meal_entries').select('memo').eq('id', entry.id).single()).data,
    ).toEqual({ memo: '원래 메모' })
    expect((await food(id)).first_tried_date).toBe('2026-10-15')
    expect(
      (await clientA().from('meal_entry_foods').select('food_id').eq('meal_entry_id', entry.id))
        .data,
    ).toEqual([{ food_id: id }])
  })
})

describe('처음 먹은 날과 상태 재계산 (BR-11~12)', () => {
  it('계획은 상태를 바꾸지 않고 첫 먹음만 알림 목록에 넣으며 일반 전환은 이력이 없다', async () => {
    const id = await addFood()
    const entry = await meal([id], { eaten: false })
    expect(entry.first_tried_foods).toEqual([])
    expect(await food(id)).toMatchObject({ status: 'not_tried', first_tried_date: null })
    const checked = await clientA().rpc('set_meal_eaten', { id: entry.id, eaten: true })
    expect(checked.error).toBeNull()
    expect(result(checked.data).first_tried_foods).toEqual([{ id, name: '쌀' }])
    expect(await food(id)).toMatchObject({ status: 'tried', first_tried_date: '2026-10-15' })
    expect(
      result((await clientA().rpc('set_meal_eaten', { id: entry.id, eaten: true })).data)
        .first_tried_foods,
    ).toEqual([])
    expect(await history(id)).toEqual([])
  })

  it('처음 먹음으로 저장해도 알림을 반환하고, 더 이른 칸 추가는 재알림 없이 날짜만 갱신한다', async () => {
    const id = await addFood()
    expect((await meal([id])).first_tried_foods).toEqual([{ id, name: '쌀' }])
    expect((await meal([id], { date: '2026-10-14' })).first_tried_foods).toEqual([])
    expect((await food(id)).first_tried_date).toBe('2026-10-14')
  })

  it('칸 삭제·체크 해제 때 남은 가장 이른 날짜를 쓰고, 마지막 기록이 없으면 되돌린다', async () => {
    const id = await addFood()
    const later = await meal([id])
    const earlier = await meal([id], { date: '2026-10-14' })
    await remove(earlier.id)
    expect((await food(id)).first_tried_date).toBe('2026-10-15')
    expect((await clientA().rpc('set_meal_eaten', { id: later.id, eaten: false })).error).toBeNull()
    expect(await food(id)).toMatchObject({ status: 'not_tried', first_tried_date: null })
    expect(await history(id)).toEqual([])
  })

  it('음식을 교체하면 이전 음식과 새 음식 모두 재계산하고, 날짜 변경도 반영한다', async () => {
    const rice = await addFood()
    const carrot = await addFood('당근')
    const entry = await meal([rice])
    const changed = await meal([carrot], { id: entry.id, date: '2026-10-16' })
    expect(changed.first_tried_foods).toEqual([{ id: carrot, name: '당근' }])
    expect(await food(rice)).toMatchObject({ status: 'not_tried', first_tried_date: null })
    expect((await food(carrot)).first_tried_date).toBe('2026-10-16')
    await meal([carrot], { id: entry.id, date: '2026-10-14' })
    expect((await food(carrot)).first_tried_date).toBe('2026-10-14')
  })

  it('레시피만 기록하면 음식의 상태·처음 먹은 날·이력은 바뀌지 않는다 (BR-15)', async () => {
    const id = await addFood('당근')
    const before = await food(id)
    expect((await meal([], { recipes: [{ recipe_name: '당근죽' }] })).first_tried_foods).toEqual([])
    expect(await food(id)).toEqual(before)
    expect(await history(id)).toEqual([])
  })

  it('같은 음식의 칸을 동시에 저장해도 가장 이른 날짜를 유지한다', async () => {
    const id = await addFood()
    const saved = await Promise.all([
      save([id], { date: '2026-10-14' }),
      save([id], { date: '2026-10-15' }),
    ])
    expect(saved.map((item) => item.error)).toEqual([null, null])
    expect(saved.flatMap((item) => result(item.data).first_tried_foods)).toEqual([
      { id, name: '쌀' },
    ])
    expect((await food(id)).first_tried_date).toBe('2026-10-14')
  })
})

describe('앱 사용 전 먹은 음식 (BR-17)과 update_food 연동', () => {
  it('직접 입력한 날과 식단 중 이른 날을 쓰고, 칸을 모두 지워도 직접 입력을 유지한다', async () => {
    const id = await addFood('쌀', { already_tried: true, first_tried_date: '2026-10-12' })
    const late = await meal([id])
    expect(late.first_tried_foods).toEqual([])
    expect((await food(id)).first_tried_date).toBe('2026-10-12')
    const early = await meal([id], { date: '2026-10-11' })
    expect((await food(id)).first_tried_date).toBe('2026-10-11')
    await remove(early.id)
    await remove(late.id)
    expect(await food(id)).toMatchObject({ status: 'tried', first_tried_date: '2026-10-12' })
  })

  it('처음 먹은 날을 모르는 이미 먹어 본 음식도 유지하고 첫 시도 알림을 보내지 않는다', async () => {
    const id = await addFood('쌀', { already_tried: true })
    const entry = await meal([id])
    expect(entry.first_tried_foods).toEqual([])
    await remove(entry.id)
    expect(await food(id)).toMatchObject({ status: 'tried', first_tried_date: null })
  })

  it('이미 먹어 봤어요를 해제해도 먹음 칸이 있으면 먹어봄을 유지한다', async () => {
    const id = await addFood('쌀', { already_tried: true, first_tried_date: '2026-10-12' })
    const entry = await meal([id])
    const updated = await clientA().rpc('update_food', {
      food_id: id,
      name: '쌀',
      food_group: 'grain',
      already_tried: false,
    })
    expect(updated.error).toBeNull()
    expect(updated.data).toMatchObject({
      status: 'tried',
      manual_tried: false,
      first_tried_date: '2026-10-15',
    })
    await remove(entry.id)
    expect((await food(id)).status).toBe('not_tried')
  })

  it('update_food로 직접 입력한 날을 바꿔도 더 이른 식단 날짜를 유지한다', async () => {
    const id = await addFood()
    await meal([id])
    const updated = await clientA().rpc('update_food', {
      food_id: id,
      name: '쌀',
      food_group: 'grain',
      already_tried: true,
      first_tried_date: '2026-10-16',
    })
    expect(updated.error).toBeNull()
    expect(updated.data).toMatchObject({
      status: 'tried',
      manual_tried: true,
      first_tried_date: '2026-10-15',
    })
  })
})

describe('알러지·주의 자동 전환·되돌림 (BR-11, BR-13, D11, R49)', () => {
  it('지정일 당일 섭취로 주의 태그가 붙고, 마지막 칸을 지우면 정보와 함께 복원한다', async () => {
    const id = await addFood('달걀')
    await caution(id)
    const entry = await meal([id], { date: '2026-10-10' })
    expect(await food(id)).toMatchObject({
      status: 'tried',
      caution_tag: true,
      caution_since: '2026-10-10',
      reaction_date: '2026-10-01',
      symptom_note: '테스트 증상',
      check_note: '테스트 확인',
    })
    expect((await history(id)).at(-1)).toMatchObject({
      trigger: 'meal_entry',
      meal_entry_id: entry.id,
    })
    await remove(entry.id)
    expect(await food(id)).toMatchObject({
      status: 'caution',
      caution_tag: false,
      first_tried_date: null,
      caution_since: '2026-10-10',
      reaction_date: '2026-10-01',
      symptom_note: '테스트 증상',
    })
    expect((await history(id)).map((item) => [item.trigger, item.meal_entry_id])).toEqual([
      ['manual', null],
      ['meal_entry', null],
      ['revert', null],
    ])
  })

  it('지정 전 식단이 남아 있어도 지정 후 기록을 체크 해제하면 알러지·주의로 복원한다', async () => {
    const id = await addFood('달걀')
    await meal([id], { date: '2026-10-05' })
    await caution(id)
    const entry = await meal([id])
    expect((await clientA().rpc('set_meal_eaten', { id: entry.id, eaten: false })).error).toBeNull()
    expect(await food(id)).toMatchObject({
      status: 'caution',
      caution_tag: false,
      first_tried_date: '2026-10-05',
    })
    expect((await history(id)).at(-1)).toMatchObject({ trigger: 'revert', meal_entry_id: entry.id })
  })

  it('지정 전 식단만 수정하면 알러지·주의가 유지되고, 지정 후 기록이 남으면 태그가 유지된다', async () => {
    const id = await addFood('달걀')
    const old = await meal([id], { date: '2026-10-05' })
    await caution(id)
    await meal([id], { id: old.id, date: '2026-10-06' })
    expect((await food(id)).status).toBe('caution')
    const first = await meal([id])
    await meal([id], { date: '2026-10-16' })
    await remove(first.id)
    expect(await food(id)).toMatchObject({
      status: 'tried',
      caution_tag: true,
      first_tried_date: '2026-10-06',
    })
    expect((await history(id)).filter((row) => row.trigger === 'meal_entry')).toHaveLength(1)
  })

  it('알러지·주의 해제 시 지정 전 섭취 기록도 먹은 기록으로 보고 정보를 이력으로 옮긴다', async () => {
    const id = await addFood('달걀')
    await meal([id], { date: '2026-10-05' })
    await caution(id)
    const released = await clientA().rpc('release_food_caution', {
      food_id: id,
      reason: '확인 완료',
    })
    expect(released.error).toBeNull()
    expect(released.data).toMatchObject({
      status: 'tried',
      caution_tag: false,
      caution_since: null,
      reaction_date: null,
      first_tried_date: '2026-10-05',
    })
    expect((await history(id)).at(-1)).toMatchObject({
      trigger: 'manual',
      to_status: 'tried',
      reason: '확인 완료',
      reaction_date: '2026-10-01',
      symptom_note: '테스트 증상',
    })
  })

  it('먹은 기록 없이 해제하면 아직 안 먹어봄, 이미 먹어 본 음식은 먹어봄으로 돌아간다', async () => {
    for (const manual of [false, true]) {
      const id = await addFood(manual ? '보리' : '쌀', { already_tried: manual })
      await caution(id)
      const released = await clientA().rpc('release_food_caution', { food_id: id })
      expect(released.error).toBeNull()
      expect(released.data).toMatchObject({
        status: manual ? 'tried' : 'not_tried',
        caution_since: null,
      })
    }
  })

  it('주의 태그를 해제하면 정보가 이력에 남고, 식단을 지워도 알러지·주의로 복원되지 않는다', async () => {
    const id = await addFood('달걀')
    await caution(id)
    const entry = await meal([id])
    const cleared = await clientA().rpc('clear_caution_tag', { food_id: id, reason: '해제 확인' })
    expect(cleared.error).toBeNull()
    expect(cleared.data).toMatchObject({
      status: 'tried',
      caution_tag: false,
      caution_since: null,
      reaction_date: null,
      symptom_note: null,
      check_note: null,
    })
    expect((await history(id)).at(-1)).toMatchObject({
      trigger: 'manual',
      from_status: 'tried',
      to_status: 'tried',
      caution_tag: false,
      reason: '해제 확인',
      reaction_date: '2026-10-01',
      symptom_note: '테스트 증상',
      check_note: '테스트 확인',
    })
    await remove(entry.id)
    expect((await food(id)).status).toBe('not_tried')
    expect((await history(id)).filter((row) => row.trigger === 'revert')).toEqual([])
  })

  it('주의 태그 해제 사유가 너무 길면 정보·태그·이력을 모두 유지한다', async () => {
    const id = await addFood('달걀')
    await caution(id)
    await meal([id])
    const before = await food(id)
    const oldHistory = await history(id)
    expect(
      (await clientA().rpc('clear_caution_tag', { food_id: id, reason: '가'.repeat(501) })).error
        ?.code,
    ).toBe('23514')
    expect(await food(id)).toEqual(before)
    expect(await history(id)).toEqual(oldHistory)
  })

  it('음식 제외·지정 전 날짜로 변경해도 알러지·주의로 복원한다', async () => {
    const id = await addFood('달걀')
    await caution(id)
    const entry = await meal([id])
    await meal([id], { id: entry.id, date: '2026-10-05' })
    expect((await food(id)).status).toBe('caution')
    await meal([id], { id: entry.id })
    expect((await food(id)).caution_tag).toBe(true)
    await meal([], { id: entry.id, recipes: [{ recipe_name: '감자죽' }] })
    expect(await food(id)).toMatchObject({
      status: 'caution',
      caution_tag: false,
      first_tried_date: null,
    })
  })
})
