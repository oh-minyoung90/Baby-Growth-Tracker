import type { Tables } from './database.types'
import {
  PhotoError,
  PHOTO_URL_SECONDS,
  RECIPE_PHOTO_BUCKET,
  photoStoragePath,
  type RecipePhoto,
} from './photoTypes'
import { prepareRecipePhoto } from './prepareRecipePhoto'
import { supabase } from './supabase'
function toPhoto(row: Pick<Tables<'photos'>, 'id' | 'owner_id' | 'storage_path'>): RecipePhoto {
  if (row.storage_path !== photoStoragePath(row.owner_id, row.id)) throw new PhotoError('metadata')
  return { id: row.id, ownerId: row.owner_id, storagePath: row.storage_path }
}
async function ownerId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new PhotoError('auth')
  return data.user.id
}
/** 업로드 도중 실패한 경우 이 실행에서 만든 새 ID의 파일·행만 정리한다. */
async function cleanupUpload(photo: RecipePhoto, metadataMayExist: boolean): Promise<void> {
  const { error } = await supabase.storage.from(RECIPE_PHOTO_BUCKET).remove([photo.storagePath])
  if (error) throw new PhotoError('cleanup', photo)
  if (metadataMayExist) {
    const removed = await supabase
      .from('photos')
      .delete()
      .eq('id', photo.id)
      .eq('owner_id', photo.ownerId)
    if (removed.error) throw new PhotoError('cleanup', photo)
  }
}
export async function uploadRecipePhoto(file: File): Promise<RecipePhoto> {
  const uid = await ownerId()
  const jpeg = await prepareRecipePhoto(file)
  const id = crypto.randomUUID()
  const photo = { id, ownerId: uid, storagePath: photoStoragePath(uid, id) }
  let metadataMayExist = false
  let uploaded = false
  let cleanupRequired = false
  try {
    cleanupRequired = true
    const result = await supabase.storage
      .from(RECIPE_PHOTO_BUCKET)
      .upload(photo.storagePath, jpeg, {
        contentType: 'image/jpeg',
        upsert: false,
        cacheControl: '3600',
      })
    if (result.error || !result.data) {
      if (result.error && 'statusCode' in result.error && String(result.error.statusCode) === '409')
        cleanupRequired = false
      throw new PhotoError('upload')
    }
    uploaded = true
    metadataMayExist = true
    const { data, error } = await supabase
      .from('photos')
      .insert({ id, owner_id: uid, storage_path: photo.storagePath })
      .select('id,owner_id,storage_path')
      .single()
    if (error || !data) throw new PhotoError('metadata')
    return toPhoto(data)
  } catch (error) {
    if (cleanupRequired) await cleanupUpload(photo, metadataMayExist)
    throw error instanceof PhotoError ? error : new PhotoError(uploaded ? 'metadata' : 'upload')
  }
}
export async function fetchRecipePhoto(id: string): Promise<RecipePhoto | null> {
  const { data, error } = await supabase
    .from('photos')
    .select('id,owner_id,storage_path')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new PhotoError('network')
  return data ? toPhoto(data) : null
}
export async function getRecipePhotoUrl(id: string): Promise<{ url: string; expiresAt: number }> {
  const photo = await fetchRecipePhoto(id)
  if (!photo) throw new PhotoError('notFound')
  const { data, error } = await supabase.storage
    .from(RECIPE_PHOTO_BUCKET)
    .createSignedUrl(photo.storagePath, PHOTO_URL_SECONDS)
  if (error || !data?.signedUrl) throw new PhotoError('network')
  return { url: data.signedUrl, expiresAt: Date.now() + PHOTO_URL_SECONDS * 1000 }
}
/** 파일 삭제 성공 후 메타데이터를 지운다. 외래 키로 레시피의 사진 참조만 null이 된다. */
export async function deleteRecipePhoto(id: string): Promise<void> {
  const photo = await fetchRecipePhoto(id)
  if (!photo) return
  if (photo.ownerId !== (await ownerId())) throw new PhotoError('auth')
  const { error } = await supabase.storage.from(RECIPE_PHOTO_BUCKET).remove([photo.storagePath])
  if (error) throw new PhotoError('network')
  const removed = await supabase.from('photos').delete().eq('id', id).eq('owner_id', photo.ownerId)
  if (removed.error) throw new PhotoError('cleanup', photo)
}
