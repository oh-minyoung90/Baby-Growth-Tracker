import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteRecipePhoto, getRecipePhotoUrl, uploadRecipePhoto } from './recipePhotoApi'
import { prepareRecipePhoto } from './prepareRecipePhoto'
const mock = vi.hoisted(() => ({
  from: vi.fn(),
  getUser: vi.fn(),
  storageFrom: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  sign: vi.fn(),
  single: vi.fn(),
  maybeSingle: vi.fn(),
  deletion: vi.fn(),
}))
vi.mock('./supabase', () => ({
  supabase: {
    from: mock.from,
    auth: { getUser: mock.getUser },
    storage: { from: mock.storageFrom },
  },
}))
vi.mock('./prepareRecipePhoto', () => ({ prepareRecipePhoto: vi.fn() }))
const uid = '00000000-0000-4000-8000-000000000001'
const id = '00000000-0000-4000-8000-000000000002'
const row = { id, owner_id: uid, storage_path: `${uid}/${id}.jpg` }
const chain = {
  insert: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  delete: vi.fn(),
  single: mock.single,
  maybeSingle: mock.maybeSingle,
}
beforeEach(() => {
  vi.resetAllMocks()
  mock.getUser.mockResolvedValue({ data: { user: { id: uid } }, error: null })
  mock.storageFrom.mockReturnValue({
    upload: mock.upload,
    remove: mock.remove,
    createSignedUrl: mock.sign,
  })
  mock.from.mockReturnValue(chain)
  chain.insert.mockReturnValue(chain)
  chain.select.mockReturnValue(chain)
  chain.delete.mockReturnValue(chain)
  chain.eq.mockImplementation(() => Object.assign(Promise.resolve({ error: null }), chain))
  mock.upload.mockResolvedValue({ data: { path: row.storage_path }, error: null })
  mock.remove.mockResolvedValue({ data: [], error: null })
  mock.sign.mockResolvedValue({
    data: { signedUrl: 'https://example.invalid/signed-private-token' },
    error: null,
  })
  mock.single.mockImplementation(async () => {
    const value = chain.insert.mock.calls[0][0]
    return { data: value, error: null }
  })
  mock.maybeSingle.mockResolvedValue({ data: row, error: null })
  vi.mocked(prepareRecipePhoto).mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' }))
})
const file = () => new File(['png'], '원본 이름.png', { type: 'image/png' })
describe('비공개 사진 API', () => {
  it('새 UUID 경로에 변환 JPEG만 업로드하고 메타데이터를 나중에 저장한다', async () => {
    const photo = await uploadRecipePhoto(file())
    expect(photo.ownerId).toBe(uid)
    expect(photo.storagePath).toBe(`${uid}/${photo.id}.jpg`)
    expect(mock.upload).toHaveBeenCalledWith(
      photo.storagePath,
      expect.objectContaining({ type: 'image/jpeg' }),
      { contentType: 'image/jpeg', upsert: false, cacheControl: '3600' },
    )
    expect(chain.insert).toHaveBeenCalledWith({
      id: photo.id,
      owner_id: uid,
      storage_path: photo.storagePath,
    })
    expect(mock.upload.mock.invocationCallOrder[0]).toBeLessThan(
      chain.insert.mock.invocationCallOrder[0],
    )
    expect(mock.remove).not.toHaveBeenCalled()
  })
  it('메타데이터 저장 실패 시 새 파일·행을 정리한다', async () => {
    mock.single.mockResolvedValueOnce({ data: null, error: new Error('network') })
    await expect(uploadRecipePhoto(file())).rejects.toMatchObject({ reason: 'metadata' })
    const inserted = chain.insert.mock.calls[0][0]
    expect(mock.remove).toHaveBeenCalledExactlyOnceWith([inserted.storage_path])
    expect(chain.delete).toHaveBeenCalledOnce()
    expect(chain.eq).toHaveBeenCalledWith('id', inserted.id)
  })
  it('정리도 실패하면 다시 정리할 사진 ID를 오류에 보존한다', async () => {
    mock.single.mockResolvedValueOnce({ data: null, error: new Error('network') })
    mock.remove.mockResolvedValueOnce({ error: new Error('network') })
    await expect(uploadRecipePhoto(file())).rejects.toMatchObject({
      reason: 'cleanup',
      pendingPhoto: { ownerId: uid, storagePath: expect.stringContaining(uid) },
    })
    expect(chain.delete).not.toHaveBeenCalled()
  })
  it('업로드 응답을 못 받아도 파일 정리를 시도하며 기존 경로 충돌은 지우지 않는다', async () => {
    mock.upload.mockResolvedValueOnce({ data: null, error: { statusCode: '500' } })
    await expect(uploadRecipePhoto(file())).rejects.toMatchObject({ reason: 'upload' })
    expect(mock.remove).toHaveBeenCalledOnce()
    expect(chain.insert).not.toHaveBeenCalled()
    mock.remove.mockClear()
    mock.upload.mockResolvedValueOnce({ data: null, error: { statusCode: '409' } })
    await expect(uploadRecipePhoto(file())).rejects.toMatchObject({ reason: 'upload' })
    expect(mock.remove).not.toHaveBeenCalled()
  })
  it('로그아웃·파일 검증 실패면 Storage에 올리지 않는다', async () => {
    mock.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    await expect(uploadRecipePhoto(file())).rejects.toMatchObject({ reason: 'auth' })
    vi.mocked(prepareRecipePhoto).mockRejectedValueOnce(new Error('invalid'))
    await expect(uploadRecipePhoto(file())).rejects.toThrow('invalid')
    expect(mock.upload).not.toHaveBeenCalled()
  })
  it('1시간 서명 URL만 만들고 없는 사진은 서명하지 않는다', async () => {
    expect((await getRecipePhotoUrl(id)).url).toContain('signed-private-token')
    expect(mock.sign).toHaveBeenCalledExactlyOnceWith(row.storage_path, 3600)
    mock.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    await expect(getRecipePhotoUrl('missing')).rejects.toMatchObject({ reason: 'notFound' })
    expect(mock.sign).toHaveBeenCalledTimes(1)
  })
  it('파일 삭제 후 메타데이터를 지우고 파일 삭제 실패 시 행은 유지한다', async () => {
    await deleteRecipePhoto(id)
    expect(mock.remove).toHaveBeenCalledWith([row.storage_path])
    expect(mock.remove.mock.invocationCallOrder[0]).toBeLessThan(
      chain.delete.mock.invocationCallOrder[0],
    )
    chain.delete.mockClear()
    mock.remove.mockResolvedValueOnce({ error: new Error('network') })
    await expect(deleteRecipePhoto(id)).rejects.toMatchObject({ reason: 'network' })
    expect(chain.delete).not.toHaveBeenCalled()
  })
  it('DB 경로가 잘못되면 Storage의 다른 경로를 읽거나 지우지 않는다', async () => {
    mock.maybeSingle.mockResolvedValueOnce({
      data: { ...row, storage_path: '다른경로/사진.jpg' },
      error: null,
    })
    await expect(deleteRecipePhoto(id)).rejects.toMatchObject({ reason: 'metadata' })
    expect(mock.remove).not.toHaveBeenCalled()
  })
})
