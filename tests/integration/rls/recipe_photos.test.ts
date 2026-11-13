import { readFile } from 'node:fs/promises'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../src/lib/database.types'
import { createAnonClient, createUserClient } from '../supabase'
type Client = SupabaseClient<Database>
const bucket = 'recipe-photos'
let a: Awaited<ReturnType<typeof createUserClient>>
let b: Awaited<ReturnType<typeof createUserClient>>
let jpeg: Uint8Array
const objects: { client: Client; path: string; id: string }[] = []
const recipes: string[] = []
beforeAll(async () => {
  a = await createUserClient('A')
  b = await createUserClient('B')
  jpeg = new Uint8Array(await readFile(new URL('../../fixtures/photo.jpg', import.meta.url)))
})
afterEach(async () => {
  for (const id of recipes) {
    const { error } = await a.client.from('recipes').delete().eq('id', id)
    if (error) throw error
  }
  recipes.length = 0
  for (const item of objects) {
    const removed = await item.client.storage.from(bucket).remove([item.path])
    if (removed.error) throw new Error('검증 파일 정리 실패')
    const deleted = await item.client.from('photos').delete().eq('id', item.id)
    if (deleted.error) throw deleted.error
  }
  objects.length = 0
})
function path(user = a) {
  const id = crypto.randomUUID()
  const entry = { id, path: `${user.userId}/${id}.jpg`, client: user.client }
  objects.push(entry)
  return entry
}
async function upload(user = a) {
  const entry = path(user)
  const { error } = await user.client.storage
    .from(bucket)
    .upload(entry.path, jpeg, { contentType: 'image/jpeg', upsert: false })
  if (error) throw new Error('검증 사진 업로드 실패')
  return entry
}

describe('비공개 사진 저장소 (T-48)', () => {
  it('본인만 다운로드·서명할 수 있고 공개 URL은 접근을 거부한다', async () => {
    const file = await upload()
    expect((await a.client.storage.from(bucket).download(file.path)).error).toBeNull()
    expect((await b.client.storage.from(bucket).download(file.path)).error).toBeTruthy()
    expect((await createAnonClient().storage.from(bucket).download(file.path)).error).toBeTruthy()
    expect(
      (await b.client.storage.from(bucket).createSignedUrl(file.path, 3600)).error,
    ).toBeTruthy()
    const signed = await a.client.storage.from(bucket).createSignedUrl(file.path, 3600)
    expect(signed.error).toBeNull()
    expect(Boolean(signed.data?.signedUrl)).toBe(true)
    let status: number
    try {
      status = (await fetch(signed.data!.signedUrl)).status
    } catch {
      throw new Error('검증 서명 URL 조회 실패')
    }
    expect(status).toBe(200)
    const publicUrl = a.client.storage.from(bucket).getPublicUrl(file.path).data.publicUrl
    let publicStatus: number
    try {
      publicStatus = (await fetch(publicUrl)).status
    } catch {
      throw new Error('공개 접근 검증 요청 실패')
    }
    expect(publicStatus).not.toBe(200)
  })
  it('타인의 폴더에 업로드·덮어쓰기·삭제할 수 없다', async () => {
    const file = await upload()
    const otherPath = path()
    expect(
      (
        await b.client.storage
          .from(bucket)
          .upload(otherPath.path, jpeg, { contentType: 'image/jpeg' })
      ).error,
    ).toBeTruthy()
    expect(
      (await b.client.storage.from(bucket).update(file.path, jpeg, { contentType: 'image/jpeg' }))
        .error,
    ).toBeTruthy()
    await b.client.storage.from(bucket).remove([file.path])
    expect((await a.client.storage.from(bucket).download(file.path)).error).toBeNull()
    expect((await b.client.storage.from(bucket).list(a.userId)).data ?? []).toEqual([])
  })
  it('본인의 기존 경로도 upsert로 덮어쓰지 못하고 교체에는 새 ID를 쓴다', async () => {
    const file = await upload()
    expect(
      (
        await a.client.storage
          .from(bucket)
          .upload(file.path, jpeg, { contentType: 'image/jpeg', upsert: true })
      ).error,
    ).toBeTruthy()
    expect(
      (await a.client.storage.from(bucket).update(file.path, jpeg, { contentType: 'image/jpeg' }))
        .error,
    ).toBeTruthy()
    const downloaded = await a.client.storage.from(bucket).download(file.path)
    expect(downloaded.error).toBeNull()
    expect(new Uint8Array(await downloaded.data!.arrayBuffer())).toEqual(jpeg)
  })
  it('JPEG 외 형식과 잘못된 경로·비로그인 업로드를 거부한다', async () => {
    const file = path()
    expect(
      (await a.client.storage.from(bucket).upload(file.path, jpeg, { contentType: 'image/png' }))
        .error,
    ).toBeTruthy()
    for (const invalid of [
      `${a.userId}/bad.jpg`,
      `${a.userId}/nested/${file.id}.jpg`,
      `${a.userId}/${file.id}.png`,
    ]) {
      expect(
        (await a.client.storage.from(bucket).upload(invalid, jpeg, { contentType: 'image/jpeg' }))
          .error,
      ).toBeTruthy()
    }
    expect(
      (
        await createAnonClient()
          .storage.from(bucket)
          .upload(file.path, jpeg, { contentType: 'image/jpeg' })
      ).error,
    ).toBeTruthy()
  })
  it('파일 삭제 후 메타데이터를 지우면 레시피 내용은 유지하고 사진 참조만 해제한다', async () => {
    const file = await upload()
    expect(
      (await a.client.from('photos').insert({ id: file.id, storage_path: file.path })).error,
    ).toBeNull()
    const saved = await a.client
      .from('recipes')
      .insert({ name: '검증 사진 레시피', steps: ['끓여요'], photo_id: file.id })
      .select()
      .single()
    if (saved.error) throw saved.error
    recipes.push(saved.data.id)
    expect((await a.client.storage.from(bucket).remove([file.path])).error).toBeNull()
    expect((await a.client.from('photos').delete().eq('id', file.id)).error).toBeNull()
    expect(
      (await a.client.from('recipes').select('name,photo_id').eq('id', saved.data.id).single())
        .data,
    ).toEqual({ name: '검증 사진 레시피', photo_id: null })
    expect((await a.client.storage.from(bucket).download(file.path)).error).toBeTruthy()
  })
})
