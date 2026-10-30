import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { toContentKey } from '../../../src/domain/text'
import type { Database } from '../../../src/lib/database.types'
import { createAnonClient, createUserClient, ensureChild, utcDate } from '../supabase'

// foods·food_status_history 접근 제어, 이름 중복, 상태 컬럼 보호, add_food·update_food·seed_default_foods,
// 알러지·주의 지정·해제 (T-36~T-38, 기술요구사항서 5.3·8.2, D10~D11, FR-FOOD-04~07·11~13, BR-11·13·17~18,
// R45·R49, 부록 B)

type Client = SupabaseClient<Database>
type AddFoodArgs = Database['public']['Functions']['add_food']['Args']
type UpdateFoodArgs = Database['public']['Functions']['update_food']['Args']
type SetCautionArgs = Database['public']['Functions']['set_food_caution']['Args']
type FoodUpdate = Database['public']['Tables']['foods']['Update']
let a: { client: Client; userId: string }
let b: { client: Client; userId: string }
let aFoodId: string

const clear = (c: Client, id: string) => c.from('foods').delete().eq('owner_id', id)
const addFood = (c: Client, args: AddFoodArgs) => c.rpc('add_food', args)
const update = (id: string, row: FoodUpdate) =>
  a.client.from('foods').update(row).eq('id', id).select().single()

beforeAll(async () => {
  a = await createUserClient('A')
  b = await createUserClient('B')
  await ensureChild(a.client, a.userId)
  await clear(a.client, a.userId)
  await clear(b.client, b.userId)
  const { data, error } = await addFood(a.client, { name: '애호박', food_group: 'vegetable' })
  if (error) throw error
  aFoodId = data.id
})

afterAll(async () => {
  await clear(a.client, a.userId)
  await clear(b.client, b.userId)
})

describe('foods: 본인 데이터와 접근 차단', () => {
  it('B는 A의 음식을 조회·수정·삭제할 수 없다', async () => {
    expect((await b.client.from('foods').select('*').eq('id', aFoodId)).data).toEqual([])
    expect(
      (await b.client.from('foods').update({ name: '침범' }).eq('id', aFoodId).select()).data,
    ).toEqual([])
    expect((await b.client.from('foods').delete().eq('id', aFoodId).select()).data).toEqual([])
  })

  it('로그인하지 않으면 조회 결과가 비어 있고, 음식을 추가할 수 없다', async () => {
    const anon = createAnonClient()
    expect((await anon.from('foods').select('*')).data ?? []).toEqual([])
    expect((await anon.from('food_status_history').select('*')).data ?? []).toEqual([])
    expect((await addFood(anon, { name: '사과', food_group: 'fruit' })).error?.code).toBe('42501')
    expect((await anon.rpc('seed_default_foods')).error?.code).toBe('42501')
  })
})

describe('add_food: 음식 추가 (FR-FOOD-04~05, BR-17)', () => {
  it('새 음식은 로그인한 사용자의 "아직 안 먹어봄"으로 추가된다', async () => {
    const { data, error } = await addFood(a.client, {
      name: '단호박',
      food_group: 'vegetable',
      memo: '찐 다음 으깨기',
    })
    expect(error).toBeNull()
    expect(data).toMatchObject({
      owner_id: a.userId,
      name: '단호박',
      food_group: 'vegetable',
      memo: '찐 다음 으깨기',
      status: 'not_tried',
      caution_tag: false,
      manual_tried: false,
      first_tried_date: null,
      is_default: false,
    })
  })

  it('"이미 먹어 봤어요"면 먹어봄이고, 입력한 날이 처음 먹은 날이 된다', async () => {
    const withDate = await addFood(a.client, {
      name: '쌀',
      food_group: 'grain',
      already_tried: true,
      first_tried_date: '2026-07-01',
      preference: 'love',
    })
    expect(withDate.data).toMatchObject({
      status: 'tried',
      manual_tried: true,
      manual_first_tried_date: '2026-07-01',
      first_tried_date: '2026-07-01',
      preference: 'love',
    })
    // 처음 먹은 날은 선택 항목이다
    const withoutDate = await addFood(a.client, {
      name: '오트밀',
      food_group: 'grain',
      already_tried: true,
    })
    expect(withoutDate.data).toMatchObject({
      status: 'tried',
      manual_tried: true,
      first_tried_date: null,
    })
  })

  it('먹어 보지 않은 음식에 처음 먹은 날을 넣으면 거부된다', async () => {
    const { error } = await addFood(a.client, {
      name: '보리',
      food_group: 'grain',
      first_tried_date: '2026-07-01',
    })
    expect(error?.code).toBe('22023')
  })

  it('처음 먹은 날이 미래이거나 생년월일 이전이면 거부된다', async () => {
    const tried = { food_group: 'fruit', already_tried: true } as const
    expect(
      (await addFood(a.client, { ...tried, name: '배', first_tried_date: utcDate(2) })).error?.code,
    ).toBe('22007')
    expect(
      (await addFood(a.client, { ...tried, name: '배', first_tried_date: '2026-01-07' })).error
        ?.code,
    ).toBe('22007')
  })

  it('이름은 1~20자, 식품군은 정해진 값, 메모는 500자까지다', async () => {
    const codes = await Promise.all(
      [
        { name: '  ', food_group: 'fruit' },
        { name: '가'.repeat(21), food_group: 'fruit' },
        { name: '수박', food_group: 'meat' },
        { name: '수박', food_group: 'fruit', memo: '가'.repeat(501) },
      ].map(async (args) => (await addFood(a.client, args)).error?.code),
    )
    expect(codes).toEqual(['23514', '23514', '23514', '23514'])
  })
})

describe('음식 이름 중복 (BR-18, FR-FOOD-04)', () => {
  it.each(['  Oat  Milk ', '두부'.normalize('NFD'), '닭   가슴살'])(
    'DB의 name_key가 화면 규칙(toContentKey)과 같다: %j',
    async (name) => {
      const { data, error } = await addFood(a.client, { name, food_group: 'etc' })
      expect(error).toBeNull()
      expect(data?.name_key).toBe(toContentKey(name))
    },
  )

  it('띄어쓰기·대소문자만 달라도 같은 이름으로 거부된다', async () => {
    // 위에서 "  Oat  Milk ", "닭   가슴살"을 추가했다
    expect((await addFood(a.client, { name: 'oat MILK', food_group: 'dairy' })).error?.code).toBe(
      '23505',
    )
    expect(
      (await addFood(a.client, { name: '닭 가슴살', food_group: 'protein' })).error?.code,
    ).toBe('23505')
  })

  it('이름을 다른 음식과 같게 바꾸면 거부된다', async () => {
    // beforeAll에서 "애호박"을 추가했다
    const { data } = await addFood(a.client, { name: '청경채', food_group: 'vegetable' })
    if (!data) throw new Error('음식을 만들지 못했습니다')
    expect((await update(data.id, { name: ' 애호박' })).error?.code).toBe('23505')
  })

  it('다른 사람의 같은 이름과는 상관없다', async () => {
    expect((await addFood(b.client, { name: '애호박', food_group: 'vegetable' })).error).toBeNull()
  })
})

describe('상태 컬럼 보호 (D10, FR-FOOD-06)', () => {
  it('화면에서 음식을 직접 추가할 수 없다 (add_food로만 추가)', async () => {
    const { error } = await a.client
      .from('foods')
      .insert({ name: '감자', food_group: 'grain', status: 'tried' })
    expect(error?.code).toBe('42501')
  })

  it('이름·식품군·메모·반응은 바로 수정할 수 있다', async () => {
    const { data, error } = await update(aFoodId, {
      name: '애호박 ',
      food_group: 'etc',
      memo: '껍질 벗기기',
      preference: 'like',
    })
    expect(error).toBeNull()
    expect(data).toMatchObject({ food_group: 'etc', memo: '껍질 벗기기', preference: 'like' })
  })

  it.each<FoodUpdate>([
    { status: 'tried' },
    { caution_tag: true },
    { first_tried_date: '2026-10-01' },
    { caution_since: '2026-10-01' },
    { manual_tried: true },
    { manual_first_tried_date: '2026-10-01' },
    { reaction_date: '2026-10-01' },
    { symptom_note: '두드러기' },
    { check_note: '소아과 진료' },
    { is_default: true },
  ])('상태와 알러지·주의 정보는 바로 수정할 수 없다: %j', async (row) => {
    expect((await update(aFoodId, row)).error?.code).toBe('42501')
    const { data } = await a.client.from('foods').select('*').eq('id', aFoodId).single()
    expect(data).toMatchObject({
      status: 'not_tried',
      caution_tag: false,
      first_tried_date: null,
      caution_since: null,
      manual_tried: false,
      manual_first_tried_date: null,
      reaction_date: null,
      symptom_note: null,
      is_default: false,
    })
  })

  it('반응은 매우 좋아함·좋아함·보통·거부만 허용된다 (R46)', async () => {
    expect((await update(aFoodId, { preference: 'love' })).data?.preference).toBe('love')
    expect((await update(aFoodId, { preference: 'hate' })).error?.code).toBe('23514')
  })

  it('상태 이력은 화면에서 추가할 수 없다', async () => {
    const { error } = await a.client.from('food_status_history').insert({
      food_id: aFoodId,
      from_status: 'not_tried',
      to_status: 'caution',
      trigger: 'manual',
    })
    expect(error?.code).toBe('42501')
  })
})

describe('update_food: 음식 수정과 "이미 먹어 봤어요" (FR-FOOD-04~05, BR-17, R45)', () => {
  const updateFood = (c: Client, args: UpdateFoodArgs) => c.rpc('update_food', args)
  let foodId: string

  beforeAll(async () => {
    const { data, error } = await addFood(a.client, { name: '양배추', food_group: 'vegetable' })
    if (error) throw error
    foodId = data.id
  })

  it('이름·식품군·메모를 고치고, already_tried를 주지 않으면 상태는 그대로다', async () => {
    const { data, error } = await updateFood(a.client, {
      food_id: foodId,
      name: '양배추 ',
      food_group: 'etc',
      memo: '쪄서 갈기',
    })
    expect(error).toBeNull()
    expect(data).toMatchObject({
      name: '양배추 ',
      food_group: 'etc',
      memo: '쪄서 갈기',
      status: 'not_tried',
      manual_tried: false,
    })
  })

  it('아직 안 먹어봄 음식을 "이미 먹어 봤어요"로 바꾸고, 다시 되돌릴 수 있다', async () => {
    const base = { food_id: foodId, name: '양배추', food_group: 'vegetable' }
    const tried = await updateFood(a.client, {
      ...base,
      already_tried: true,
      first_tried_date: '2026-07-01',
    })
    expect(tried.data).toMatchObject({
      status: 'tried',
      manual_tried: true,
      manual_first_tried_date: '2026-07-01',
      first_tried_date: '2026-07-01',
    })

    const untried = await updateFood(a.client, { ...base, already_tried: false })
    expect(untried.data).toMatchObject({
      status: 'not_tried',
      manual_tried: false,
      manual_first_tried_date: null,
      first_tried_date: null,
    })
  })

  it('반응을 함께 저장하고, 주지 않으면 지운다 (R46)', async () => {
    const base = { food_id: foodId, name: '양배추', food_group: 'vegetable' }
    const set = await updateFood(a.client, { ...base, preference: 'refuse' })
    expect(set.data?.preference).toBe('refuse')
    expect((await updateFood(a.client, base)).data?.preference).toBeNull()
    expect((await updateFood(a.client, { ...base, preference: 'hate' })).error?.code).toBe('23514')
  })

  it('먹어 보지 않은 음식에 처음 먹은 날을 넣으면 거부된다', async () => {
    const base = { food_id: foodId, name: '양배추', food_group: 'vegetable' }
    expect(
      (await updateFood(a.client, { ...base, first_tried_date: '2026-07-01' })).error?.code,
    ).toBe('22023')
    expect(
      (
        await updateFood(a.client, {
          ...base,
          already_tried: false,
          first_tried_date: '2026-07-01',
        })
      ).error?.code,
    ).toBe('22023')
  })

  it('처음 먹은 날이 미래이거나 생년월일 이전이면 거부된다', async () => {
    const base = { food_id: foodId, name: '양배추', food_group: 'vegetable', already_tried: true }
    expect(
      (await updateFood(a.client, { ...base, first_tried_date: utcDate(2) })).error?.code,
    ).toBe('22007')
    expect(
      (await updateFood(a.client, { ...base, first_tried_date: '2026-01-07' })).error?.code,
    ).toBe('22007')
  })

  it('생년월일을 고친 뒤에도, 처음 먹은 날을 그대로 두면 이름은 고칠 수 있다', async () => {
    const base = {
      food_id: foodId,
      food_group: 'vegetable',
      already_tried: true,
      first_tried_date: '2026-07-01',
    }
    expect((await updateFood(a.client, { ...base, name: '양배추' })).error).toBeNull()
    await ensureChild(a.client, a.userId, '2026-08-01')
    try {
      const { data, error } = await updateFood(a.client, { ...base, name: '양배추 찜' })
      expect(error).toBeNull()
      expect(data).toMatchObject({ name: '양배추 찜', manual_first_tried_date: '2026-07-01' })
      // 처음 먹은 날을 바꾸면 새 생년월일로 검사한다
      expect(
        (await updateFood(a.client, { ...base, name: '양배추', first_tried_date: '2026-07-02' }))
          .error?.code,
      ).toBe('22007')
    } finally {
      await ensureChild(a.client, a.userId)
    }
  })

  it('같은 이름, 정해지지 않은 식품군, 21자 이름은 거부된다', async () => {
    // beforeAll에서 "애호박"을 추가했다
    const base = { food_id: foodId, food_group: 'vegetable' }
    expect((await updateFood(a.client, { ...base, name: ' 애호박' })).error?.code).toBe('23505')
    expect(
      (await updateFood(a.client, { ...base, name: '양배추', food_group: 'meat' })).error?.code,
    ).toBe('23514')
    expect((await updateFood(a.client, { ...base, name: '가'.repeat(21) })).error?.code).toBe(
      '23514',
    )
  })

  it('다른 사람의 음식은 고칠 수 없고(P0002), 로그인하지 않으면 호출할 수 없다', async () => {
    const read = async () =>
      (await a.client.from('foods').select('*').eq('id', foodId).single()).data
    const before = await read()
    const args = { food_id: foodId, name: '침범', food_group: 'etc', already_tried: false }
    expect((await updateFood(b.client, args)).error?.code).toBe('P0002')
    expect((await updateFood(createAnonClient(), args)).error?.code).toBe('42501')
    expect(await read()).toEqual(before)
  })
})

describe('알러지·주의 지정·해제 (FR-FOOD-11~13, BR-11, BR-13, D11, R49)', () => {
  const setCaution = (c: Client, args: SetCautionArgs) => c.rpc('set_food_caution', args)
  const release = (c: Client, foodId: string, reason?: string) =>
    c.rpc('release_food_caution', { food_id: foodId, reason })
  const history = async (foodId: string) =>
    (
      await a.client
        .from('food_status_history')
        .select('*')
        .eq('food_id', foodId)
        .order('changed_at')
    ).data ?? []
  // 화면은 기기의 오늘을 보낸다. 테스트는 UTC 날짜로 대신한다
  const today = utcDate(0)
  let tofuId: string
  let yogurtId: string

  beforeAll(async () => {
    const tofu = await addFood(a.client, { name: '두부', food_group: 'etc' })
    const yogurt = await addFood(a.client, {
      name: '요거트',
      food_group: 'dairy',
      already_tried: true,
      first_tried_date: '2026-07-01',
    })
    if (tofu.error) throw tofu.error
    if (yogurt.error) throw yogurt.error
    tofuId = tofu.data.id
    yogurtId = yogurt.data.id
  })

  it('아직 안 먹어봄 음식을 지정하면 알러지·주의가 되고, 사유와 함께 이력이 남는다', async () => {
    const { data, error } = await setCaution(a.client, {
      food_id: tofuId,
      reaction_date: '2026-10-01',
      today,
      symptom_note: '두드러기',
      reason: '소아과 권유',
    })
    expect(error).toBeNull()
    expect(data).toMatchObject({
      status: 'caution',
      caution_tag: false,
      caution_since: today,
      reaction_date: '2026-10-01',
      symptom_note: '두드러기',
      check_note: null,
    })
    expect(await history(tofuId)).toEqual([
      expect.objectContaining({
        owner_id: a.userId,
        from_status: 'not_tried',
        to_status: 'caution',
        caution_tag: false,
        trigger: 'manual',
        reason: '소아과 권유',
        reaction_date: null,
      }),
    ])
  })

  it('이미 알러지·주의면 반응 날짜·메모만 고치고, 지정한 날과 이력은 그대로다', async () => {
    const { data, error } = await setCaution(a.client, {
      food_id: tofuId,
      reaction_date: '2026-10-02',
      today,
      symptom_note: '두드러기 심함',
      check_note: '소아과 진료',
    })
    expect(error).toBeNull()
    expect(data).toMatchObject({
      status: 'caution',
      caution_since: today,
      reaction_date: '2026-10-02',
      symptom_note: '두드러기 심함',
      check_note: '소아과 진료',
    })
    expect(await history(tofuId)).toHaveLength(1)
  })

  it('알러지·주의 음식은 update_food로 이름은 고칠 수 있지만 already_tried는 거부한다 (22023)', async () => {
    const base = { food_id: tofuId, name: '두부', food_group: 'etc' }
    const renamed = await a.client.rpc('update_food', { ...base, memo: '부침용' })
    expect(renamed.error).toBeNull()
    expect(renamed.data).toMatchObject({ status: 'caution', memo: '부침용' })
    expect((await a.client.rpc('update_food', { ...base, already_tried: true })).error?.code).toBe(
      '22023',
    )
  })

  it('반응 날짜는 미래·생년월일 이전·기기의 오늘 이후를 거부하고, 메모·사유는 500자까지다', async () => {
    const base = { food_id: tofuId, today }
    expect(
      (await setCaution(a.client, { ...base, reaction_date: utcDate(3), today: utcDate(3) })).error
        ?.code,
    ).toBe('22007')
    expect(
      (
        await setCaution(a.client, {
          food_id: tofuId,
          reaction_date: '2026-10-02',
          today: '2026-10-01',
        })
      ).error?.code,
    ).toBe('22007')
    expect((await setCaution(a.client, { ...base, reaction_date: '2026-01-07' })).error?.code).toBe(
      '22007',
    )
    const long = '가'.repeat(501)
    expect(
      (await setCaution(a.client, { ...base, reaction_date: '2026-10-02', symptom_note: long }))
        .error?.code,
    ).toBe('23514')
    expect(
      (await setCaution(a.client, { ...base, reaction_date: '2026-10-02', check_note: long })).error
        ?.code,
    ).toBe('23514')
  })

  it('해제하면 먹은 기록이 없는 음식은 아직 안 먹어봄이 되고, 알러지·주의 정보는 이력으로 옮긴다 (R49)', async () => {
    const { data, error } = await release(a.client, tofuId, '괜찮다고 함')
    expect(error).toBeNull()
    expect(data).toMatchObject({
      status: 'not_tried',
      caution_since: null,
      reaction_date: null,
      symptom_note: null,
      check_note: null,
      first_tried_date: null,
    })
    expect((await history(tofuId)).at(-1)).toMatchObject({
      from_status: 'caution',
      to_status: 'not_tried',
      trigger: 'manual',
      reason: '괜찮다고 함',
      reaction_date: '2026-10-02',
      symptom_note: '두드러기 심함',
      check_note: '소아과 진료',
    })
  })

  it('"이미 먹어 봤어요" 음식은 지정해도 처음 먹은 날을 지키고, 해제하면 먹어봄으로 돌아간다 (BR-17)', async () => {
    const set = await setCaution(a.client, {
      food_id: yogurtId,
      reaction_date: '2026-10-03',
      today,
    })
    expect(set.data).toMatchObject({
      status: 'caution',
      manual_tried: true,
      first_tried_date: '2026-07-01',
    })
    const released = await release(a.client, yogurtId)
    expect(released.data).toMatchObject({
      status: 'tried',
      manual_tried: true,
      first_tried_date: '2026-07-01',
      reaction_date: null,
    })
    expect((await history(yogurtId)).map((row) => [row.from_status, row.to_status])).toEqual([
      ['tried', 'caution'],
      ['caution', 'tried'],
    ])
  })

  it('알러지·주의가 아닌 음식은 해제할 수 없고, "주의" 태그가 없으면 태그 해제도 거부한다 (22023)', async () => {
    // 정상적인 "주의" 태그 해제는 식단으로 태그가 붙는 T-40에서 확인한다
    expect((await release(a.client, tofuId)).error?.code).toBe('22023')
    expect((await a.client.rpc('clear_caution_tag', { food_id: yogurtId })).error?.code).toBe(
      '22023',
    )
  })

  it('해제 사유는 500자까지다', async () => {
    await setCaution(a.client, { food_id: tofuId, reaction_date: '2026-10-01', today })
    try {
      expect((await release(a.client, tofuId, '가'.repeat(501))).error?.code).toBe('23514')
    } finally {
      await release(a.client, tofuId)
    }
  })

  it('다른 사람의 음식은 지정·해제할 수 없고(P0002), 로그인하지 않으면 호출할 수 없다 (42501)', async () => {
    const args = { food_id: tofuId, reaction_date: '2026-10-01', today }
    expect((await setCaution(b.client, args)).error?.code).toBe('P0002')
    expect((await release(b.client, yogurtId)).error?.code).toBe('P0002')
    expect((await b.client.rpc('clear_caution_tag', { food_id: yogurtId })).error?.code).toBe(
      'P0002',
    )
    const anon = createAnonClient()
    expect((await setCaution(anon, args)).error?.code).toBe('42501')
    expect((await release(anon, yogurtId)).error?.code).toBe('42501')
    expect((await anon.rpc('clear_caution_tag', { food_id: yogurtId })).error?.code).toBe('42501')
    // 이력도 본인 것만 보인다
    expect(
      (await b.client.from('food_status_history').select('*').eq('food_id', tofuId)).data,
    ).toEqual([])
  })
})

describe('seed_default_foods: 기본 음식 목록 (FR-FOOD-07, 부록 B)', () => {
  beforeAll(async () => {
    await clear(a.client, a.userId)
  })

  it('기본 음식 42개를 "아직 안 먹어봄"으로 추가하고, 같은 이름이 있으면 건너뛴다', async () => {
    // 기본 음식과 이름이 같은 음식을 먼저 추가해 둔다
    await addFood(a.client, {
      name: ' 사과',
      food_group: 'fruit',
      memo: '직접 추가',
      already_tried: true,
    })

    const { data: added, error } = await a.client.rpc('seed_default_foods')
    expect(error).toBeNull()
    expect(added).toBe(41)

    const { data: foods } = await a.client.from('foods').select('*')
    expect(foods).toHaveLength(42)
    const defaults = (foods ?? []).filter((food) => food.is_default)
    expect(defaults).toHaveLength(41)
    expect(defaults.every((food) => food.status === 'not_tried' && !food.manual_tried)).toBe(true)

    const countByGroup = Object.fromEntries(
      ['grain', 'vegetable', 'fruit', 'protein', 'dairy', 'etc'].map((group) => [
        group,
        (foods ?? []).filter((food) => food.food_group === group).length,
      ]),
    )
    expect(countByGroup).toEqual({
      grain: 7,
      vegetable: 13,
      fruit: 8,
      protein: 7,
      dairy: 3,
      etc: 4,
    })

    // 먼저 있던 같은 이름의 음식은 그대로 둔다
    expect(foods?.find((food) => food.name_key === '사과')).toMatchObject({
      memo: '직접 추가',
      status: 'tried',
      is_default: false,
    })
  })

  it('다시 호출해도 같은 음식을 또 추가하지 않는다', async () => {
    const { data: added } = await a.client.rpc('seed_default_foods')
    expect(added).toBe(0)
    const { count } = await a.client.from('foods').select('*', { count: 'exact', head: true })
    expect(count).toBe(42)
  })

  it('기본 음식도 일반 음식처럼 수정·삭제할 수 있다', async () => {
    const { data: rice } = await a.client.from('foods').select('id').eq('name_key', '쌀').single()
    if (!rice) throw new Error('기본 음식 "쌀"이 없습니다')
    expect((await update(rice.id, { memo: '불린 쌀' })).error).toBeNull()
    expect((await a.client.from('foods').delete().eq('id', rice.id).select()).data).toHaveLength(1)
  })
})
