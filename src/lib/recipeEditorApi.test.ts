import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PhotoError } from './photoTypes'
import { deleteRecipe, fetchRecipe, saveRecipe, type RecipeInput } from './recipeApi'
import {
  discardRecipeDraft,
  removeRecipeWithPhoto,
  saveRecipeDraft,
  type RecipeEditSession,
} from './recipeEditorApi'
import { cleanupPendingRecipePhoto, deleteRecipePhoto, uploadRecipePhoto } from './recipePhotoApi'
vi.mock('./recipeApi', () => ({ deleteRecipe: vi.fn(), fetchRecipe: vi.fn(), saveRecipe: vi.fn() }))
vi.mock('./recipePhotoApi', () => ({
  cleanupPendingRecipePhoto: vi.fn(),
  deleteRecipePhoto: vi.fn(),
  uploadRecipePhoto: vi.fn(),
}))
const input: Omit<RecipeInput, 'photoId'> = {
  name: '쌀죽',
  servings: null,
  ingredients: [{ foodId: null, name: '물', amount: null }],
  steps: ['끓이기'],
  note: null,
}
const newPhoto = { id: 'new-photo', ownerId: 'owner', storagePath: 'owner/new-photo.jpg' }
const file = new File(['photo'], 'photo.png', { type: 'image/png' })
function session(): RecipeEditSession {
  return {
    id: 'r1',
    createNew: false,
    oldPhotoId: 'old-photo',
    uploaded: null,
    uploadCleanup: null,
    committed: false,
  }
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(uploadRecipePhoto).mockResolvedValue(newPhoto)
})
describe('레시피·사진 저장 재시도', () => {
  it('새 업로드 → 레시피 저장 → 이전 파일 정리 순서로 교체한다', async () => {
    const state = session()
    await saveRecipeDraft(state, input, file, false)
    expect(saveRecipe).toHaveBeenCalledWith('r1', { ...input, photoId: newPhoto.id }, false)
    expect(vi.mocked(uploadRecipePhoto).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(saveRecipe).mock.invocationCallOrder[0],
    )
    expect(vi.mocked(saveRecipe).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(deleteRecipePhoto).mock.invocationCallOrder[0],
    )
    expect(deleteRecipePhoto).toHaveBeenCalledWith('old-photo')
  })
  it('저장 실패는 기존 사진을 보존하고 다음 시도에서 업로드를 재사용한다', async () => {
    vi.mocked(saveRecipe).mockRejectedValueOnce(new Error('network'))
    const state = session()
    await expect(saveRecipeDraft(state, input, file, false)).rejects.toThrow()
    expect(deleteRecipePhoto).not.toHaveBeenCalled()
    await saveRecipeDraft(state, input, file, false)
    expect(uploadRecipePhoto).toHaveBeenCalledTimes(1)
    expect(saveRecipe).toHaveBeenCalledTimes(2)
  })
  it('저장 후 이전 사진 정리 실패는 재시도에서 저장을 반복하지 않는다', async () => {
    vi.mocked(deleteRecipePhoto).mockRejectedValueOnce(new Error('network'))
    const state = session()
    await expect(saveRecipeDraft(state, input, file, false)).rejects.toThrow()
    expect(state.committed).toBe(true)
    await saveRecipeDraft(state, input, file, false)
    expect(saveRecipe).toHaveBeenCalledTimes(1)
    expect(deleteRecipePhoto).toHaveBeenCalledTimes(2)
  })
  it('사진을 유지하는 저장은 파일을 지우지 않는다', async () => {
    await saveRecipeDraft(session(), input, null, false)
    expect(deleteRecipePhoto).not.toHaveBeenCalled()
    expect(uploadRecipePhoto).not.toHaveBeenCalled()
    expect(saveRecipe).toHaveBeenCalledWith('r1', { ...input, photoId: 'old-photo' }, false)
  })
  it('사진 삭제는 레시피에서 연결을 해제한 후 파일을 정리한다', async () => {
    await saveRecipeDraft(session(), input, null, true)
    expect(saveRecipe).toHaveBeenCalledWith('r1', { ...input, photoId: null }, false)
    expect(deleteRecipePhoto).toHaveBeenCalledWith('old-photo')
  })
  it('취소는 미저장 업로드만 정리한다', async () => {
    const state = session()
    state.uploaded = newPhoto
    vi.mocked(fetchRecipe).mockResolvedValue({ ...input, id: 'r1', photoId: 'old-photo' })
    await discardRecipeDraft(state)
    expect(deleteRecipePhoto).toHaveBeenCalledExactlyOnceWith('new-photo')
  })
  it('응답이 유실돼도 저장된 새 사진은 취소에서 지우지 않는다', async () => {
    const state = session()
    state.uploaded = newPhoto
    state.targetPhotoId = newPhoto.id
    vi.mocked(fetchRecipe).mockResolvedValue({ ...input, id: 'r1', photoId: newPhoto.id })
    await discardRecipeDraft(state)
    expect(deleteRecipePhoto).toHaveBeenCalledExactlyOnceWith('old-photo')
    expect(state.committed).toBe(true)
  })
  it('삭제 연결 해제의 응답 유실 후 취소도 이전 파일을 정리한다', async () => {
    const state = session()
    state.targetPhotoId = null
    vi.mocked(fetchRecipe).mockResolvedValue({ ...input, id: 'r1', photoId: null })
    await discardRecipeDraft(state)
    expect(deleteRecipePhoto).toHaveBeenCalledExactlyOnceWith('old-photo')
  })
  it('서버 저장 여부를 확인 못하면 취소 중 새 파일을 지우지 않는다', async () => {
    const state = session()
    state.uploaded = newPhoto
    state.targetPhotoId = newPhoto.id
    vi.mocked(fetchRecipe).mockRejectedValue(new Error('network'))
    await expect(discardRecipeDraft(state)).rejects.toThrow()
    expect(deleteRecipePhoto).not.toHaveBeenCalled()
  })
  it('메타데이터 없는 업로드 정리 실패도 경로를 유지해 다시 정리한다', async () => {
    const state = session()
    vi.mocked(uploadRecipePhoto).mockRejectedValueOnce(new PhotoError('cleanup', newPhoto))
    await expect(saveRecipeDraft(state, input, file, false)).rejects.toThrow()
    await saveRecipeDraft(state, input, file, false)
    expect(cleanupPendingRecipePhoto).toHaveBeenCalledWith(newPhoto)
    expect(state.uploadCleanup).toBeNull()
  })
  it('레시피 삭제는 사진을 정리한 뒤 레시피를 지우고 실패 시 보존한다', async () => {
    vi.mocked(fetchRecipe).mockResolvedValue({ ...input, id: 'r1', photoId: 'old-photo' })
    vi.mocked(deleteRecipePhoto).mockRejectedValueOnce(new Error('network'))
    await expect(removeRecipeWithPhoto('r1')).rejects.toThrow()
    expect(deleteRecipe).not.toHaveBeenCalled()
    await removeRecipeWithPhoto('r1')
    expect(deleteRecipe).toHaveBeenCalledWith('r1')
  })
})
