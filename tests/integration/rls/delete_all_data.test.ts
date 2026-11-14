import { readFile } from 'node:fs/promises'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Backup } from '../../../src/lib/backupSchema'
import type { Json } from '../../../src/lib/database.types'
import { deleteAllDataFor } from '../../../src/lib/deleteAllData'
import { exampleBackup } from '../../../src/test/backupFixture'
import { createAnonClient, createUserClient } from '../supabase'
const bucket = 'recipe-photos'
let a: Awaited<ReturnType<typeof createUserClient>>, b: Awaited<ReturnType<typeof createUserClient>>
let originalA: Backup, originalB: Backup, jpeg: Uint8Array
const originalFiles: { path: string; blob: Blob }[] = [],
  created: { user: 'A' | 'B'; path: string }[] = []
async function snapshot(user: typeof a): Promise<Backup> {
  const r = await user.client.rpc('export_backup')
  if (r.error) throw new Error('검증 상태 보관 실패')
  return r.data as unknown as Backup
}
async function restore(user: typeof a, payload: Backup) {
  const r = await user.client.rpc('import_backup', { payload: payload as unknown as Json })
  if (r.error) throw new Error('검증 계정 복구 실패')
}
async function list(user: typeof a) {
  const found: { id: string | null; name: string }[] = []
  for (let offset = 0; ; offset += 1000) {
    const r = await user.client.storage
      .from(bucket)
      .list(user.userId, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } })
    if (r.error || !r.data) throw new Error('검증 사진 목록 보관 실패')
    found.push(...r.data)
    if (r.data.length < 1000) return found
  }
}
async function upload(user: 'A' | 'B') {
  const account = user === 'A' ? a : b
  const path = `${account.userId}/${crypto.randomUUID()}.jpg`
  const r = await account.client.storage
    .from(bucket)
    .upload(path, jpeg, { contentType: 'image/jpeg', upsert: false })
  if (r.error) throw new Error('검증 사진 준비 실패')
  created.push({ user, path })
  return path
}
beforeAll(async () => {
  a = await createUserClient('A')
  b = await createUserClient('B')
  originalA = await snapshot(a)
  originalB = await snapshot(b)
  jpeg = new Uint8Array(await readFile(new URL('../../fixtures/photo.jpg', import.meta.url)))
  let size = 0
  for (const entry of await list(a)) {
    if (!entry.id) throw new Error('검증 계정에 지원하지 않는 사진 폴더가 있습니다')
    const path = `${a.userId}/${entry.name}`,
      r = await a.client.storage.from(bucket).download(path)
    if (r.error || !r.data) throw new Error('검증 원본 사진 보관 실패')
    size += r.data.size
    if (size > 20 * 1024 * 1024)
      throw new Error('검증 원본 사진이 많아 삭제 테스트를 시작하지 않았습니다')
    originalFiles.push({ path, blob: r.data })
  }
  if (originalFiles.length) {
    const r = await a.client.storage.from(bucket).remove(originalFiles.map((f) => f.path))
    if (r.error) throw new Error('검증 원본 사진 임시 정리 실패')
  }
})
beforeEach(async () => {
  await restore(a, exampleBackup(a.userId))
})
afterEach(async () => {
  for (const user of ['A', 'B'] as const) {
    const paths = created.filter((item) => item.user === user).map((item) => item.path)
    if (paths.length) {
      const r = await (user === 'A' ? a : b).client.storage.from(bucket).remove(paths)
      if (r.error) throw new Error('검증 사진 정리 실패')
    }
  }
  created.length = 0
  if (originalA) await restore(a, originalA)
  if (originalB) await restore(b, originalB)
})
afterAll(async () => {
  if (a) {
    const existing = new Set((await list(a)).map((file) => `${a.userId}/${file.name}`))
    for (const file of originalFiles)
      if (!existing.has(file.path)) {
        const r = await a.client.storage
          .from(bucket)
          .upload(file.path, file.blob, { contentType: 'image/jpeg', upsert: false })
        if (r.error) throw new Error('검증 원본 사진 복구 실패')
      }
  }
  await a?.client.auth.signOut({ scope: 'local' })
  await b?.client.auth.signOut({ scope: 'local' })
})
describe('전체 삭제·권한·사진 정리 (T-31)', () => {
  it('본인 12개 테이블만 비우고 다른 계정·로그인은 유지하며 반복 호출도 성공한다', async () => {
    const marker = await b.client.rpc('add_food', {
      name: '보존 검증' + crypto.randomUUID().slice(0, 5),
      food_group: 'grain',
    })
    expect(marker.error).toBeNull()
    const beforeB = await snapshot(b)
    expect(
      (await a.client.rpc('delete_all_data', { expected_owner_id: a.userId })).error,
    ).toBeNull()
    expect(Object.values((await snapshot(a)).data).every((rows) => rows.length === 0)).toBe(true)
    expect(JSON.stringify((await snapshot(b)).data) === JSON.stringify(beforeB.data)).toBe(true)
    expect((await a.client.auth.getUser()).data.user?.id === a.userId).toBe(true)
    expect(
      (await a.client.rpc('delete_all_data', { expected_owner_id: a.userId })).error,
    ).toBeNull()
  })
  it('파일이 남으면 DB를 지우지 않고 파일 정리 뒤에만 성공한다', async () => {
    const path = await upload('A'),
      before = await snapshot(a)
    const r = await a.client.rpc('delete_all_data', { expected_owner_id: a.userId })
    expect(r.error?.message).toBe('delete_photos_remaining')
    expect(JSON.stringify((await snapshot(a)).data) === JSON.stringify(before.data)).toBe(true)
    expect((await a.client.storage.from(bucket).download(path)).error).toBeNull()
    await a.client.storage.from(bucket).remove([path])
    expect(
      (await a.client.rpc('delete_all_data', { expected_owner_id: a.userId })).error,
    ).toBeNull()
  })
  it('실제 API는 메타데이터 없는 사진도 지우고 타인 파일은 남긴다', async () => {
    await upload('A')
    await upload('A')
    const foreign = await upload('B')
    await deleteAllDataFor(a.client)
    expect((await list(a)).length).toBe(0)
    expect(Object.values((await snapshot(a)).data).every((rows) => rows.length === 0)).toBe(true)
    expect((await b.client.storage.from(bucket).download(foreign)).error).toBeNull()
  })
  it('비로그인·다른 계정으로 바뀐 요청은 거부하고 양쪽 데이터를 보존한다', async () => {
    const beforeA = await snapshot(a),
      beforeB = await snapshot(b)
    expect(
      (await createAnonClient().rpc('delete_all_data', { expected_owner_id: a.userId })).error,
    ).not.toBeNull()
    expect(
      (await a.client.rpc('delete_all_data', { expected_owner_id: b.userId })).error?.message,
    ).toBe('delete_auth')
    expect(
      (await b.client.rpc('delete_all_data', { expected_owner_id: a.userId })).error?.message,
    ).toBe('delete_auth')
    expect(JSON.stringify((await snapshot(a)).data) === JSON.stringify(beforeA.data)).toBe(true)
    expect(JSON.stringify((await snapshot(b)).data) === JSON.stringify(beforeB.data)).toBe(true)
  })
})
