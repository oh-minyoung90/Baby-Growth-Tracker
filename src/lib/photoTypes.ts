export const RECIPE_PHOTO_BUCKET = 'recipe-photos'
export const PHOTO_MAX_BYTES = 20 * 1024 * 1024
export const PHOTO_MAX_EDGE = 1280
export const PHOTO_URL_SECONDS = 3600
export interface RecipePhoto {
  id: string
  ownerId: string
  storagePath: string
}
export type PhotoErrorReason =
  | 'size'
  | 'format'
  | 'decode'
  | 'encode'
  | 'auth'
  | 'upload'
  | 'metadata'
  | 'cleanup'
  | 'notFound'
  | 'network'
export class PhotoError extends Error {
  readonly reason: PhotoErrorReason
  readonly pendingPhoto?: RecipePhoto
  constructor(reason: PhotoErrorReason, pendingPhoto?: RecipePhoto) {
    super(reason)
    this.reason = reason
    this.pendingPhoto = pendingPhoto
  }
}
export const PHOTO_MESSAGES: Record<PhotoErrorReason, string> = {
  size: '사진은 20MB 이하로 골라 주세요',
  format: 'JPG, PNG, HEIC 사진을 골라 주세요',
  decode: '사진을 읽지 못했어요. 다른 사진으로 다시 시도해 주세요',
  encode: '사진을 변환하지 못했어요. 다시 시도해 주세요',
  auth: '로그인 상태를 확인해 주세요',
  upload: '사진을 올리지 못했어요. 다시 시도해 주세요',
  metadata: '사진 정보를 저장하지 못했어요. 다시 시도해 주세요',
  cleanup: '사진 정리를 마치지 못했어요. 다시 시도해 주세요',
  notFound: '사진을 찾을 수 없어요',
  network: '사진을 불러오거나 정리하지 못했어요. 다시 시도해 주세요',
}
export function photoStoragePath(ownerId: string, id: string): string {
  return `${ownerId}/${id}.jpg`
}
export function fitPhotoSize(width: number, height: number): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
    throw new PhotoError('decode')
  const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}
