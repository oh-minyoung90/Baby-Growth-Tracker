import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { mkdir, readFile, rm, writeFile, open } from 'node:fs/promises'
import { join } from 'node:path'
import type { Database, Json } from '../../src/lib/database.types.ts'
import type { Backup } from '../../src/lib/backupSchema.ts'
import { e2eEnvironment } from './environment.ts'

const directory = join(process.cwd(), '.e2e-recovery')
const snapshotFile = join(directory, 'snapshot.json')
const lockFile = join(directory, 'run.lock')
const bucket = 'recipe-photos'
type Saved = {
  owner: string
  project: string
  backup: Backup
  files: { path: string; base64: string; contentType: string }[]
}
export type Data = {
  client: SupabaseClient<Database>
  session: Session
  owner: string
}

export async function login(): Promise<Data> {
  const env = e2eEnvironment()
  const client = createClient<Database>(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await client.auth.signInWithPassword({
    email: env.TEST_USER_A_EMAIL,
    password: env.TEST_USER_A_PASSWORD,
  })
  if (error || !data.session) throw new Error('dev 테스트 계정 A 로그인 실패')
  return { client, session: data.session, owner: data.user.id }
}

export async function lock() {
  await mkdir(directory, { recursive: true, mode: 0o700 })
  // 중단된 프로세스의 잠금만 해제한다. 동시 실행은 같은 계정을 훼손할 수 있다.
  try {
    const pid = Number(await readFile(lockFile, 'utf8'))
    let active = true
    try {
      process.kill(pid, 0)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ESRCH') active = false
    }
    if (active) throw new Error('다른 E2E 실행이 진행 중입니다. 종료 후 다시 실행하세요.')
    await rm(lockFile)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  const file = await open(lockFile, 'wx', 0o600)
  await file.writeFile(String(process.pid))
  await file.close()
  return () => rm(lockFile, { force: true })
}

export async function exported({ client }: Data): Promise<Backup> {
  const result = await client.rpc('export_backup')
  if (result.error) throw new Error('E2E 기록 조회 실패')
  return result.data as unknown as Backup
}
export async function replace(data: Data, backup: Backup) {
  const result = await data.client.rpc('import_backup', { payload: backup as unknown as Json })
  if (result.error) throw new Error('E2E 기록 준비·복구 실패')
}
async function paths({ client, owner }: Data) {
  const all: string[] = []
  for (let offset = 0; ; offset += 1000) {
    const result = await client.storage.from(bucket).list(owner, {
      limit: 1000,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (result.error || result.data.some((item) => !item.id))
      throw new Error('E2E 사진 목록 조회 실패')
    all.push(...result.data.map((item) => `${owner}/${item.name}`))
    if (result.data.length < 1000) return all
  }
}

/** 원본은 출력하지 않고 권한 600인 로컬 복구 파일에 남긴다. 세션은 기록하지 않는다. */
export async function preserve(data: Data) {
  try {
    await readFile(snapshotFile)
    throw new Error('이전 복구 파일이 남아 있습니다. npm run test:e2e:recover를 먼저 실행하세요.')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  const saved: Saved = {
    owner: data.owner,
    project: e2eEnvironment().E2E_DEV_PROJECT_REF,
    backup: await exported(data),
    files: [],
  }
  const rows = Object.values(saved.backup.data).reduce((sum, items) => sum + items.length, 0)
  if (rows > 20_000 || Buffer.byteLength(JSON.stringify(saved.backup)) > 10 * 1024 * 1024)
    throw new Error('기존 테스트 기록이 복원 한도를 넘어 실행하지 않았습니다.')
  let total = 0
  for (const path of await paths(data)) {
    const result = await data.client.storage.from(bucket).download(path)
    if (result.error) throw new Error('E2E 기존 사진 보관 실패')
    total += result.data.size
    if (total > 20 * 1024 * 1024)
      throw new Error('테스트 계정 사진이 20MB를 넘어 실행하지 않았습니다.')
    saved.files.push({
      path,
      contentType: result.data.type || 'image/jpeg',
      base64: Buffer.from(await result.data.arrayBuffer()).toString('base64'),
    })
  }
  await writeFile(snapshotFile, JSON.stringify(saved), { mode: 0o600, flag: 'wx' })
}

export async function restore(data: Data) {
  const saved = JSON.parse(await readFile(snapshotFile, 'utf8')) as Saved
  if (saved.owner !== data.owner || saved.project !== e2eEnvironment().E2E_DEV_PROJECT_REF)
    throw new Error('복구 파일의 테스트 계정·프로젝트가 현재 설정과 다릅니다.')
  const current = await paths(data)
  const original = new Set(saved.files.map((file) => file.path))
  const extra = current.filter((path) => !original.has(path))
  for (let offset = 0; offset < extra.length; offset += 100) {
    const result = await data.client.storage.from(bucket).remove(extra.slice(offset, offset + 100))
    if (result.error) throw new Error('E2E 임시 사진 정리 실패. 복구 파일을 보관합니다.')
  }
  await replace(data, saved.backup)
  for (const file of saved.files) {
    if (current.includes(file.path)) continue
    const result = await data.client.storage
      .from(bucket)
      .upload(file.path, Buffer.from(file.base64, 'base64'), {
        contentType: file.contentType,
        upsert: false,
      })
    if (result.error) throw new Error('E2E 원래 사진 복구 실패. 복구 파일을 보관합니다.')
  }
  // 실패 시 개인 데이터가 테스트 리포터에 덤프되지 않도록 boolean만 비교한다.
  if (JSON.stringify((await exported(data)).data) !== JSON.stringify(saved.backup.data))
    throw new Error('E2E 기록 복구 검증 실패. 복구 파일을 보관합니다.')
  const restored = await paths(data)
  if (restored.length !== original.size || restored.some((path) => !original.has(path)))
    throw new Error('E2E 사진 복구 검증 실패. 복구 파일을 보관합니다.')
  await rm(snapshotFile)
}
