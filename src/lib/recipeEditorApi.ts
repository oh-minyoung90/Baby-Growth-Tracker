import { PhotoError, type RecipePhoto } from './photoTypes'
import { deleteRecipe, fetchRecipe, saveRecipe, type RecipeInput } from './recipeApi'
import { cleanupPendingRecipePhoto, deleteRecipePhoto, uploadRecipePhoto } from './recipePhotoApi'

/** 한 편집 세션의 업로드·저장·정리 진행을 보존한다. 재시도에서 이미 저장한 레시피를 다시 만들지 않는다. */
export interface RecipeEditSession {
  id: string
  createNew: boolean
  oldPhotoId: string | null
  uploaded: RecipePhoto | null
  uploadCleanup: RecipePhoto | null
  committed: boolean
  targetPhotoId?: string | null
}
async function cleanupFailedUpload(session: RecipeEditSession) {
  if (session.uploadCleanup) {
    await cleanupPendingRecipePhoto(session.uploadCleanup)
    session.uploadCleanup = null
  }
}
export async function finishRecipePhotoCleanup(session: RecipeEditSession): Promise<void> {
  if (session.oldPhotoId) {
    await deleteRecipePhoto(session.oldPhotoId)
    session.oldPhotoId = null
  }
}
export async function saveRecipeDraft(
  session: RecipeEditSession,
  input: Omit<RecipeInput, 'photoId'>,
  file: File | null,
  removePhoto: boolean,
): Promise<void> {
  if (session.committed) return finishRecipePhotoCleanup(session)
  await cleanupFailedUpload(session)
  if (file && !session.uploaded) {
    try {
      session.uploaded = await uploadRecipePhoto(file)
    } catch (error) {
      if (error instanceof PhotoError && error.pendingPhoto)
        session.uploadCleanup = error.pendingPhoto
      throw error
    }
  }
  const photoId = session.uploaded?.id ?? (removePhoto ? null : session.oldPhotoId)
  session.targetPhotoId = photoId
  await saveRecipe(session.id, { ...input, photoId }, session.createNew)
  session.committed = true
  if (photoId === session.oldPhotoId) session.oldPhotoId = null
  await finishRecipePhotoCleanup(session)
}
/** 응답 유실 가능성이 있어 서버 저장 결과를 확인한 뒤 버린다. 저장된 새 사진은 지우지 않는다. */
export async function discardRecipeDraft(session: RecipeEditSession): Promise<void> {
  await cleanupFailedUpload(session)
  if (session.committed) return finishRecipePhotoCleanup(session)
  if (session.targetPhotoId === undefined && !session.uploaded) return
  const saved = await fetchRecipe(session.id)
  if (saved && session.targetPhotoId !== undefined && saved.photoId === session.targetPhotoId) {
    session.committed = true
    if (saved.photoId === session.oldPhotoId) session.oldPhotoId = null
    await finishRecipePhotoCleanup(session)
  } else if (session.uploaded) {
    await deleteRecipePhoto(session.uploaded.id)
    session.uploaded = null
  }
}
/** 사진 파일·메타데이터 정리를 먼저 마치고 레시피를 지운다. 실패하면 같은 ID로 재시도한다. */
export async function removeRecipeWithPhoto(id: string): Promise<void> {
  const recipe = await fetchRecipe(id)
  if (recipe?.photoId) await deleteRecipePhoto(recipe.photoId)
  await deleteRecipe(id)
}
