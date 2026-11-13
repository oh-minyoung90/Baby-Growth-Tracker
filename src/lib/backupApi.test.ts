import { beforeEach, describe, expect, it, vi } from 'vitest'
import { exampleBackup, emptyBackup } from '@/test/backupFixture'
import { BACKUP_MAX_BYTES } from './backupSchema'
import {
  downloadBackup,
  exportBackup,
  importBackup,
  readBackupFile,
  validateBackup,
} from './backupApi'
const mock = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('./supabase', () => ({ supabase: { rpc: mock.rpc } }))
beforeEach(() => vi.resetAllMocks())
describe('백업 형식·파일·API', () => {
  it('전체 테이블의 예시와 빈 백업을 받아들이고 기록·사진 경로를 보존한다', () => {
    const payload = exampleBackup()
    expect(validateBackup(payload)).toEqual(payload)
    expect(validateBackup(emptyBackup()).data.recipes).toEqual([])
  })
  it.each([
    'version',
    'missing',
    'owner',
    'duplicate',
    'foreign',
    'photo',
    'null',
    'type',
    'emptyChild',
  ])('%s 오류를 파일 검사 단계에서 거부한다', (kind) => {
    const payload = exampleBackup() as unknown as Record<string, unknown>
    const data = payload.data as Record<string, Record<string, unknown>[]>
    if (kind === 'version') payload.schema_version = 2
    if (kind === 'missing') delete data.recipes[0].name
    if (kind === 'owner') data.recipes[0].owner_id = 'other'
    if (kind === 'duplicate') data.recipes.push({ ...data.recipes[0] })
    if (kind === 'foreign') data.recipe_ingredients[0].food_id = crypto.randomUUID()
    if (kind === 'photo') data.photos[0].storage_path = 'other/photo.jpg'
    if (kind === 'null') data.meal_entries[0].eaten = null
    if (kind === 'type') data.meal_entries[0].eaten = 'false'
    if (kind === 'emptyChild') data.children = []
    expect(() => validateBackup(payload)).toThrow()
  })
  it('항목이 너무 많으면 크기 오류로 거부한다', () => {
    const payload = exampleBackup()
    payload.data.milestones = Array(20001).fill(payload.data.milestones[0])
    expect(() => validateBackup(payload)).toThrow(expect.objectContaining({ reason: 'size' }))
  })
  it('BOM이 있는 JSON도 읽고 JSON 형식 오류·큰 파일은 거부한다', async () => {
    const payload = exampleBackup()
    const file = (content: string) =>
      Object.assign(new File([content], 'backup.json'), { text: async () => content })
    expect(await readBackupFile(file('\uFEFF' + JSON.stringify(payload)))).toEqual(payload)
    await expect(readBackupFile(file('{'))).rejects.toMatchObject({ reason: 'format' })
    const large = file('')
    Object.defineProperty(large, 'size', { value: BACKUP_MAX_BYTES + 1 })
    await expect(readBackupFile(large)).rejects.toMatchObject({ reason: 'size' })
  })
  it('내보낸 응답을 검증하고 검증한 파일만 복원 RPC에 보낸다', async () => {
    const payload = exampleBackup()
    mock.rpc.mockResolvedValueOnce({ data: payload, error: null })
    expect(await exportBackup()).toEqual(payload)
    mock.rpc.mockResolvedValueOnce({ error: null })
    await importBackup(payload)
    expect(mock.rpc).toHaveBeenLastCalledWith('import_backup', { payload })
    mock.rpc.mockResolvedValueOnce({ error: { message: 'backup_invalid' } })
    await expect(importBackup(payload)).rejects.toMatchObject({ reason: 'invalid' })
  })
  it('서버가 상위 버전·네트워크 오류를 반환하면 구분해 알린다', async () => {
    mock.rpc.mockResolvedValueOnce({ error: { message: 'backup_newer_version' } })
    await expect(importBackup(exampleBackup())).rejects.toMatchObject({ reason: 'newerVersion' })
    mock.rpc.mockResolvedValueOnce({ error: { message: 'network' } })
    await expect(exportBackup()).rejects.toMatchObject({ reason: 'network' })
  })
  it('파일 이름에 기기 날짜를 쓰고 JSON 다운로드 후 임시 링크를 정리한다', () => {
    const create = vi.fn(() => 'blob:backup'),
      revoke = vi.fn()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      expect(this.download).toMatch(/^baby-growth-backup-\d{8}\.json$/)
    })
    downloadBackup(exampleBackup())
    expect(create).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    expect(document.querySelector('a[download]')).toBeNull()
    click.mockRestore()
    vi.unstubAllGlobals()
  })
})
