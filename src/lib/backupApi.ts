import { format } from 'date-fns'
import type { Json } from './database.types'
import { BACKUP_MAX_BYTES, type Backup } from './backupSchema'
import { supabase } from './supabase'
export { BackupError, BACKUP_MESSAGES, validateBackup } from './backupValidation'
import { BackupError, validateBackup } from './backupValidation'
export async function readBackupFile(file: File): Promise<Backup> {
  if (file.size > BACKUP_MAX_BYTES) throw new BackupError('size')
  let value: unknown
  try {
    value = JSON.parse((await file.text()).replace(/^\uFEFF/, ''))
  } catch {
    throw new BackupError('format')
  }
  return validateBackup(value)
}
export async function exportBackup(): Promise<Backup> {
  const { data, error } = await supabase.rpc('export_backup')
  if (error) throw new BackupError(error.message === 'backup_size' ? 'size' : 'network')
  return validateBackup(data)
}
export async function importBackup(payload: Backup): Promise<void> {
  const checked = validateBackup(payload)
  const { error } = await supabase.rpc('import_backup', { payload: checked as unknown as Json })
  if (error)
    throw new BackupError(
      error.message === 'backup_newer_version'
        ? 'newerVersion'
        : error.message === 'backup_invalid'
          ? 'invalid'
          : error.message === 'backup_size'
            ? 'size'
            : 'network',
    )
}
export function downloadBackup(payload: Backup): void {
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
  if (blob.size > BACKUP_MAX_BYTES) throw new BackupError('size')
  const url = URL.createObjectURL(blob),
    link = document.createElement('a')
  link.href = url
  link.download = `baby-growth-backup-${format(new Date(), 'yyyyMMdd')}.json`
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
