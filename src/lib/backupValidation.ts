import {
  BACKUP_LABELS,
  BACKUP_MAX_ROWS,
  backupSchema,
  type Backup,
  type BackupTable,
} from './backupSchema'
export type BackupErrorReason = 'format' | 'newerVersion' | 'size' | 'invalid' | 'network'
export const BACKUP_MESSAGES: Record<BackupErrorReason, string> = {
  format: 'JSON 형식의 백업 파일을 선택해 주세요',
  newerVersion: '현재 앱보다 높은 버전의 백업이에요. 앱을 업데이트한 뒤 다시 시도해 주세요',
  size: '백업은 10MB 이하, 기록은 20,000개 이하인 파일을 선택해 주세요',
  invalid: '백업 내용이 올바르지 않거나 현재 입력 규칙에 맞지 않아요. 기존 데이터는 유지됐어요',
  network: '요청을 완료하지 못했어요. 연결을 확인하고 다시 시도해 주세요',
}
export class BackupError extends Error {
  readonly reason: BackupErrorReason
  constructor(reason: BackupErrorReason, detail?: string) {
    super(detail ?? BACKUP_MESSAGES[reason])
    this.reason = reason
  }
}
const references: [BackupTable, string, BackupTable][] = [
  ['recipes', 'photo_id', 'photos'],
  ['recipe_ingredients', 'recipe_id', 'recipes'],
  ['recipe_ingredients', 'food_id', 'foods'],
  ['meal_entry_foods', 'meal_entry_id', 'meal_entries'],
  ['meal_entry_foods', 'food_id', 'foods'],
  ['meal_entry_recipes', 'meal_entry_id', 'meal_entries'],
  ['meal_entry_recipes', 'recipe_id', 'recipes'],
  ['food_status_history', 'food_id', 'foods'],
  ['food_status_history', 'meal_entry_id', 'meal_entries'],
]
/** 파일과 서버 응답을 같은 스키마로 검증한다. 비밀키·서명 URL은 형식에 포함하지 않는다. */
export function validateBackup(value: unknown): Backup {
  if (
    value &&
    typeof value === 'object' &&
    'schema_version' in value &&
    typeof value.schema_version === 'number' &&
    value.schema_version > 1
  )
    throw new BackupError('newerVersion')
  const parsed = backupSchema.safeParse(value)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const table = String(issue.path[1]) as BackupTable
    throw new BackupError(
      'invalid',
      BACKUP_LABELS[table]
        ? `${BACKUP_LABELS[table]}의 ${typeof issue.path[2] === 'number' ? `${issue.path[2] + 1}번째 ` : ''}필수 항목·형식·길이를 확인해 주세요`
        : undefined,
    )
  }
  const payload = parsed.data
  const tables = Object.keys(BACKUP_LABELS) as BackupTable[]
  const total = tables.reduce((sum, table) => sum + payload.data[table].length, 0)
  if (total > BACKUP_MAX_ROWS) throw new BackupError('size')
  if (payload.data.children.length > 1 || (!payload.data.children.length && total > 0))
    throw new BackupError('invalid', '아이 정보가 없거나 여러 개예요. 백업 파일을 확인해 주세요')
  const ids = Object.fromEntries(
    tables.map((table) => [table, new Set(payload.data[table].map((row) => row.id))]),
  ) as Record<BackupTable, Set<string>>
  for (const table of tables)
    if (ids[table].size !== payload.data[table].length)
      throw new BackupError('invalid', `${BACKUP_LABELS[table]}에 중복된 기록 ID가 있어요`)
  for (const [table, column, target] of references)
    for (const row of payload.data[table]) {
      const id = (row as unknown as Record<string, unknown>)[column]
      if (id !== null && (typeof id !== 'string' || !ids[target].has(id)))
        throw new BackupError('invalid', `${BACKUP_LABELS[table]}의 연결된 기록이 백업에 없어요`)
    }
  for (const photo of payload.data.photos)
    if (photo.storage_path !== `${payload.source_owner_id}/${photo.id}.jpg`)
      throw new BackupError('invalid', '사진 경로가 백업 계정의 경로와 맞지 않아요')
  return payload
}
