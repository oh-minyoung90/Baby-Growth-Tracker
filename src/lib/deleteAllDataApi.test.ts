import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyBackup } from '@/test/backupFixture'
import { deleteAllData } from './deleteAllDataApi'
const mock = vi.hoisted(() => ({
  getUser: vi.fn(),
  storage: vi.fn(),
  list: vi.fn(),
  remove: vi.fn(),
  rpc: vi.fn(),
  signOut: vi.fn(),
}))
vi.mock('./supabase', () => ({
  supabase: {
    auth: { getUser: mock.getUser, signOut: mock.signOut },
    storage: { from: mock.storage },
    rpc: mock.rpc,
  },
}))
const uid = '00000000-0000-4000-8000-000000000001'
let files: { id: string; name: string }[]
const file = () => {
  const id = crypto.randomUUID()
  return { id, name: `${id}.jpg` }
}
beforeEach(() => {
  vi.resetAllMocks()
  files = []
  mock.getUser.mockResolvedValue({ data: { user: { id: uid } }, error: null })
  mock.storage.mockReturnValue({ list: mock.list, remove: mock.remove })
  mock.list.mockImplementation(async () => ({ data: files.slice(0, 100), error: null }))
  mock.remove.mockImplementation(async (paths: string[]) => {
    files = files.filter((file) => !paths.includes(`${uid}/${file.name}`))
    return { data: [], error: null }
  })
  mock.rpc.mockResolvedValue({ error: null })
})
describe('전체 사진·기록 삭제 순서와 재시도', () => {
  it('메타데이터 여부와 무관하게 250개 파일을 첫 페이지씩 지운 뒤 본인 DB만 지운다', async () => {
    files = Array.from({ length: 250 }, file)
    await deleteAllData()
    expect(mock.remove.mock.calls.map((call) => call[0].length)).toEqual([100, 100, 50])
    expect(mock.list).toHaveBeenCalledTimes(4)
    for (const call of mock.list.mock.calls)
      expect(call).toEqual([
        uid,
        { limit: 100, offset: 0, sortBy: { column: 'name', order: 'asc' } },
      ])
    expect(mock.rpc).toHaveBeenCalledExactlyOnceWith('delete_all_data', { expected_owner_id: uid })
    expect(mock.signOut).not.toHaveBeenCalled()
  })
  it('사진 일부 정리 후 실패하면 DB를 보존하고 다음 시도는 남은 파일부터 처리한다', async () => {
    files = Array.from({ length: 105 }, file)
    mock.remove
      .mockImplementationOnce(async (paths: string[]) => {
        files = files.filter((file) => !paths.includes(`${uid}/${file.name}`))
        return { error: null }
      })
      .mockResolvedValueOnce({ error: new Error('offline') })
    await expect(deleteAllData()).rejects.toMatchObject({ reason: 'photos' })
    expect(files).toHaveLength(5)
    expect(mock.rpc).not.toHaveBeenCalled()
    await deleteAllData()
    expect(files).toHaveLength(0)
    expect(mock.rpc).toHaveBeenCalledTimes(1)
  })
  it('목록 조회 실패와 삭제 진척이 없는 응답이면 기록 삭제를 진행하지 않는다', async () => {
    mock.list.mockResolvedValueOnce({ error: new Error('offline'), data: null })
    await expect(deleteAllData()).rejects.toMatchObject({ reason: 'photos' })
    files = [file()]
    mock.remove.mockResolvedValueOnce({ error: null, data: [] })
    await expect(deleteAllData()).rejects.toMatchObject({ reason: 'photos' })
    expect(mock.rpc).not.toHaveBeenCalled()
  })
  it('다른 경로·폴더로 해석될 이름을 삭제하지 않는다', async () => {
    files = [{ id: 'unsafe', name: '../other.jpg' }]
    await expect(deleteAllData()).rejects.toMatchObject({ reason: 'photos' })
    expect(mock.remove).not.toHaveBeenCalled()
    expect(mock.rpc).not.toHaveBeenCalled()
  })
  it('로그인 실패와 계정 변경을 거부한다', async () => {
    mock.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    await expect(deleteAllData()).rejects.toMatchObject({ reason: 'auth' })
    expect(mock.storage).not.toHaveBeenCalled()
    mock.rpc.mockResolvedValueOnce({ error: { message: 'delete_auth' } })
    await expect(deleteAllData()).rejects.toMatchObject({ reason: 'auth' })
    expect(mock.rpc).toHaveBeenCalledWith('delete_all_data', { expected_owner_id: uid })
  })
  it('DB 확인 시 새 사진이 발견되면 사진 정리 재시도를 안내한다', async () => {
    mock.rpc.mockResolvedValueOnce({ error: { message: 'delete_photos_remaining' } })
    await expect(deleteAllData()).rejects.toMatchObject({ reason: 'photos' })
  })
  it('DB 응답이 유실됐어도 같은 계정의 12개 테이블이 비었으면 성공으로 확인한다', async () => {
    mock.rpc
      .mockResolvedValueOnce({ error: { message: 'offline' } })
      .mockResolvedValueOnce({ data: emptyBackup(uid), error: null })
    await expect(deleteAllData()).resolves.toBeUndefined()
    expect(mock.rpc).toHaveBeenLastCalledWith('export_backup')
  })
  it('완료 확인이 안 되거나 다른 계정의 응답이면 성공으로 처리하지 않는다', async () => {
    const snapshot = emptyBackup(uid)
    snapshot.data.children = [
      {
        id: crypto.randomUUID(),
        nickname: '검증아기',
        birth_date: '2026-01-08',
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
      },
    ]
    mock.rpc
      .mockResolvedValueOnce({ error: { message: 'offline' } })
      .mockResolvedValueOnce({ data: snapshot, error: null })
    await expect(deleteAllData()).rejects.toMatchObject({ reason: 'records' })
    mock.rpc
      .mockResolvedValueOnce({ error: { message: 'offline' } })
      .mockResolvedValueOnce({ data: emptyBackup(crypto.randomUUID()), error: null })
    await expect(deleteAllData()).rejects.toMatchObject({ reason: 'records' })
  })
})
