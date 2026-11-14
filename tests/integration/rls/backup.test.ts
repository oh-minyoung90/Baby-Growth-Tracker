import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Json } from '../../../src/lib/database.types'
import type { Backup } from '../../../src/lib/backupSchema'
import { validateBackup } from '../../../src/lib/backupValidation'
import { exampleBackup } from '../../../src/test/backupFixture'
import { createAnonClient, createUserClient } from '../supabase'
let a: Awaited<ReturnType<typeof createUserClient>>, b: Awaited<ReturnType<typeof createUserClient>>
let originalA: Backup, originalB: Backup, fixture: Backup
async function exported(user: typeof a): Promise<Backup> {
  const { data, error } = await user.client.rpc('export_backup')
  if (error) throw new Error('검증 백업 내보내기 실패')
  return validateBackup(data)
}
async function restored(user: typeof a, payload: unknown) {
  return user.client.rpc('import_backup', { payload: payload as Json })
}
beforeAll(async () => {
  a = await createUserClient('A')
  b = await createUserClient('B')
  originalA = await exported(a)
  originalB = await exported(b)
})
beforeEach(async () => {
  fixture = exampleBackup(a.userId)
  const result = await restored(a, fixture)
  if (result.error) throw new Error('검증 백업 준비 실패: ' + result.error.message)
})
afterEach(async () => {
  if (originalA) {
    const result = await restored(a, originalA)
    if (result.error) throw new Error('A 검증 계정 원래 상태 복구 실패')
  }
  if (originalB) {
    const result = await restored(b, originalB)
    if (result.error) throw new Error('B 검증 계정 원래 상태 복구 실패')
  }
})
afterAll(async () => {
  await a?.client.auth.signOut({ scope: 'local' })
  await b?.client.auth.signOut({ scope: 'local' })
})
describe('본인 백업·전체 복원 (T-29·T-30)', () => {
  it('전체 테이블·시각·순서·이력·사진 경로를 내보내고 동일하게 복원한다', async () => {
    const first = await exported(a)
    expect(Object.values(first.data).map((rows) => rows.length)).toEqual(Array(12).fill(1))
    expect(JSON.stringify(first).includes('owner_id')).toBe(true) // 출처 식별자만 포함된다.
    expect(first.data.foods[0]).not.toHaveProperty('owner_id')
    expect(first.data.foods[0]).not.toHaveProperty('name_key')
    expect((await restored(a, first)).error).toBeNull()
    const second = await exported(a)
    expect(JSON.stringify(second.data) === JSON.stringify(first.data)).toBe(true)
  })
  it('다른 계정 ID가 충돌하면 새 ID와 본인 사진 경로로 연결을 바꾸고 원본 계정은 유지한다', async () => {
    const source = await exported(a)
    expect((await restored(b, source)).error).toBeNull()
    const target = await exported(b)
    expect(target.data.foods[0].id === source.data.foods[0].id).toBe(false)
    expect(target.data.recipe_ingredients[0].food_id === target.data.foods[0].id).toBe(true)
    expect(target.data.meal_entry_recipes[0].recipe_id === target.data.recipes[0].id).toBe(true)
    expect(
      target.data.food_status_history[0].meal_entry_id === target.data.meal_entries[0].id,
    ).toBe(true)
    expect(
      target.data.photos[0].storage_path === `${b.userId}/${target.data.photos[0].id}.jpg`,
    ).toBe(true)
    expect(JSON.stringify((await exported(a)).data) === JSON.stringify(source.data)).toBe(true)
  })
  it('비로그인 내보내기·복원을 거부한다', async () => {
    const client = createAnonClient()
    expect((await client.rpc('export_backup')).error).not.toBeNull()
    expect(
      (await client.rpc('import_backup', { payload: fixture as unknown as Json })).error,
    ).not.toBeNull()
  })
  it.each([
    'version',
    'missing',
    'owner',
    'type',
    'reference',
    'uuid',
    'photo',
    'constraint',
    'sleep',
  ])('잘못된 %s 백업은 현재 데이터를 모두 유지한다', async (kind) => {
    const before = await exported(a)
    const payload = structuredClone(before) as unknown as Record<string, unknown>
    const d = payload.data as Record<string, Record<string, unknown>[]>
    if (kind === 'version') payload.schema_version = 2
    if (kind === 'missing') delete d.foods[0].name
    if (kind === 'owner') d.foods[0].owner_id = b.userId
    if (kind === 'type') d.foods[0].manual_tried = 'false'
    if (kind === 'reference') d.recipe_ingredients[0].food_id = crypto.randomUUID()
    if (kind === 'uuid') d.foods[0].id = 'not-a-uuid'
    if (kind === 'photo') d.photos[0].storage_path = `${b.userId}/${d.photos[0].id}.jpg`
    if (kind === 'constraint') d.body_measures[0].height_cm = -1
    if (kind === 'sleep') d.sleep_logs[0].wake_time = '2026-10-01T20:00:00'
    const response = await restored(a, payload)
    expect(response.error?.code).toBe('22023')
    expect(JSON.stringify((await exported(a)).data) === JSON.stringify(before.data)).toBe(true)
  })
  it('생년월일을 나중에 바꾼 기존 기록도 원래 값과 시각으로 복원한다', async () => {
    const payload = await exported(a)
    payload.data.children[0].birth_date = '2026-10-02'
    expect((await restored(a, payload)).error).toBeNull()
    const after = await exported(a)
    expect(after.data.children[0].birth_date).toBe('2026-10-02')
    expect(after.data.body_measures[0].date).toBe('2026-10-01')
    expect(after.data.children[0].updated_at).toBe(payload.data.children[0].updated_at)
  })
  it('낮잠 내부의 잘못된 타입·추가 키도 거부하고 기존 데이터를 유지한다', async () => {
    const before = await exported(a)
    const payload = structuredClone(before) as unknown as {
      data: { sleep_logs: { naps: unknown[] }[] }
    }
    payload.data.sleep_logs[0].naps = [
      { start: '2026-10-01T14:00:00', end: '2026-10-01T15:00:00', extra: '허용하지 않는 키' },
    ]
    expect((await restored(a, payload)).error?.code).toBe('22023')
    expect(JSON.stringify((await exported(a)).data) === JSON.stringify(before.data)).toBe(true)
  })
  it('5,000개 기록을 일괄 검사·복원하고 다시 내보낸다', async () => {
    const payload = exampleBackup(a.userId)
    const sample = payload.data.milestones[0]
    payload.data.milestones = Array.from({ length: 5000 }, (_, index) => ({
      ...sample,
      id: crypto.randomUUID(),
      title: `검증 단어 ${index}`,
    }))
    expect((await restored(a, payload)).error).toBeNull()
    expect((await exported(a)).data.milestones.length).toBe(5000)
  })
})
