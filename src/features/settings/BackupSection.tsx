import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Download, Upload } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ErrorBanner } from '@/components/ErrorBanner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BACKUP_LABELS, type Backup, type BackupTable } from '@/lib/backupSchema'
import {
  BackupError,
  downloadBackup,
  exportBackup,
  importBackup,
  readBackupFile,
} from '@/lib/backupApi'
import { notifyDone } from '@/lib/notify'

export function BackupSection() {
  const client = useQueryClient(),
    navigate = useNavigate()
  const [selected, setSelected] = useState<{ name: string; payload: Backup } | null>(null)
  const [pending, setPending] = useState<'export' | 'read' | 'import' | null>(null)
  const busy = useRef(false)
  const [failure, setFailure] = useState<{
    message: string
    action: 'export' | 'import' | 'read'
  } | null>(null)
  const [confirm, setConfirm] = useState(false)
  const message = (error: unknown) =>
    error instanceof BackupError ? error.message : '연결을 확인하고 다시 시도해 주세요'
  const onExport = async () => {
    if (busy.current) return
    busy.current = true
    setPending('export')
    setFailure(null)
    try {
      downloadBackup(await exportBackup())
      notifyDone('백업 파일을 내려받았어요')
    } catch (error) {
      setFailure({ message: message(error), action: 'export' })
    } finally {
      busy.current = false
      setPending(null)
    }
  }
  const onRead = async (file: File) => {
    if (busy.current) return
    busy.current = true
    setPending('read')
    setFailure(null)
    setSelected(null)
    try {
      setSelected({ name: file.name, payload: await readBackupFile(file) })
    } catch (error) {
      setFailure({ message: message(error), action: 'read' })
    } finally {
      busy.current = false
      setPending(null)
    }
  }
  const onImport = async () => {
    if (busy.current || !selected) return
    busy.current = true
    setPending('import')
    setFailure(null)
    try {
      await importBackup(selected.payload)
      await client.cancelQueries()
      client.clear()
      notifyDone('백업을 가져왔어요')
      void navigate(selected.payload.data.children.length ? '/' : '/setup', { replace: true })
    } catch (error) {
      setFailure({ message: message(error), action: 'import' })
    } finally {
      busy.current = false
      setPending(null)
    }
  }
  return (
    <section aria-labelledby="settings-backup" className="flex min-w-0 flex-col gap-3">
      <h2 id="settings-backup" className="text-[13px] font-bold text-muted-foreground">
        데이터 백업
      </h2>
      <div className="flex min-w-0 flex-col gap-4 rounded-card border bg-surface p-4 md:p-5">
        <p className="text-sm text-muted-foreground">
          아이 정보·성장·수면·음식·식단·레시피를 JSON 파일 하나로 보관해요.
        </p>
        <p className="text-sm text-muted-foreground">
          사진은 파일 경로만 포함돼요. 사진 파일이 저장소에 남아 있으면 다시 연결되고, 없으면 사진
          없음으로 표시돼요.
        </p>
        {failure && (
          <ErrorBanner
            message={failure.message}
            onRetry={
              failure.action === 'read'
                ? undefined
                : () => (failure.action === 'export' ? void onExport() : setConfirm(true))
            }
            retrying={pending !== null}
          />
        )}
        <Button
          type="button"
          variant="soft"
          disabled={pending !== null}
          onClick={() => void onExport()}
        >
          <Download aria-hidden />
          {pending === 'export' ? '내보내는 중…' : '데이터 내보내기'}
        </Button>
        <div className="flex min-w-0 flex-col gap-2 border-t pt-4">
          <label htmlFor="backup-file" className="text-sm font-bold">
            가져올 백업 파일
          </label>
          <p id="backup-file-help" className="text-sm text-muted-foreground">
            JSON 파일, 10MB 이하·20,000개 항목 이하. 파일을 확인한 다음 현재 데이터를 바꿀지 결정할
            수 있어요.
          </p>
          <Input
            id="backup-file"
            type="file"
            accept="application/json,.json"
            disabled={pending !== null}
            aria-describedby="backup-file-help"
            className="h-auto min-h-12 py-2 file:mr-2 file:text-sm"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void onRead(file)
              event.target.value = ''
            }}
          />
        </div>
        {pending === 'read' && (
          <p role="status" className="text-sm text-muted-foreground">
            백업 파일 확인 중…
          </p>
        )}
        {selected && (
          <div className="flex min-w-0 flex-col gap-3 rounded-input bg-muted p-3">
            <h3 className="font-bold">백업 내용</h3>
            <p className="text-sm break-all">{selected.name}</p>
            <p className="text-sm text-muted-foreground">
              내보낸 시각: {new Date(selected.payload.exported_at).toLocaleString('ko-KR')}
            </p>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm sm:grid-cols-3">
              {(Object.keys(BACKUP_LABELS) as BackupTable[]).map((table) => (
                <div key={table} className="flex min-w-0 flex-wrap gap-x-2">
                  <dt className="text-muted-foreground">{BACKUP_LABELS[table]}</dt>
                  <dd>{selected.payload.data[table].length}개</dd>
                </div>
              ))}
            </dl>
            <p className="text-sm text-danger-text">
              가져오면 현재 데이터가 모두 파일 내용으로 바뀌어요. 먼저 현재 데이터를 내보내 두세요.
            </p>
            <Button type="button" disabled={pending !== null} onClick={() => setConfirm(true)}>
              <Upload aria-hidden />
              {pending === 'import' ? '가져오는 중…' : '이 백업으로 가져오기'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending !== null}
              onClick={() => {
                setSelected(null)
                setFailure(null)
              }}
            >
              파일 선택 취소
            </Button>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="현재 데이터를 백업 내용으로 바꿀까요?"
        description="현재 데이터가 모두 지워지고 파일 내용으로 바뀌어요. 사진 파일 자체는 가져오지 않아요."
        confirmLabel="전체 바꾸고 가져오기"
        destructive
        onConfirm={() => void onImport()}
      />
    </section>
  )
}
