import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Download, Trash2 } from 'lucide-react'
import { ErrorBanner } from '@/components/ErrorBanner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { BackupError, downloadBackup, exportBackup } from '@/lib/backupApi'
import { deleteAllData, DeleteAllDataError } from '@/lib/deleteAllDataApi'
import { notifyDone } from '@/lib/notify'

export function DeleteAllSection({ onBusyChange }: { onBusyChange?: (busy: boolean) => void }) {
  const client = useQueryClient(),
    navigate = useNavigate()
  const [open, setOpen] = useState(false),
    [keyword, setKeyword] = useState('')
  const [pending, setPending] = useState<'export' | 'delete' | null>(null)
  const busy = useRef(false)
  const [failure, setFailure] = useState<{ action: 'export' | 'delete'; message: string } | null>(
    null,
  )
  const run = async (action: 'export' | 'delete', work: () => Promise<void>) => {
    if (busy.current) return
    busy.current = true
    setPending(action)
    setFailure(null)
    onBusyChange?.(true)
    try {
      await work()
    } catch (error) {
      setFailure({
        action,
        message:
          error instanceof BackupError || error instanceof DeleteAllDataError
            ? error.message
            : '연결을 확인하고 다시 시도해 주세요',
      })
    } finally {
      busy.current = false
      setPending(null)
      onBusyChange?.(false)
    }
  }
  const download = () =>
    run('export', async () => {
      downloadBackup(await exportBackup())
      notifyDone('백업 파일을 내려받았어요')
    })
  const remove = () => {
    if (keyword !== '삭제') return
    return run('delete', async () => {
      await deleteAllData()
      await client.cancelQueries()
      client.clear()
      notifyDone('모든 기록과 사진을 삭제했어요')
      void navigate('/setup', { replace: true })
    })
  }
  const changeOpen = (value: boolean) => {
    if (busy.current) return
    setOpen(value)
    setKeyword('')
    setFailure(null)
  }
  return (
    <section aria-labelledby="settings-delete" className="flex min-w-0 flex-col gap-3">
      <h2 id="settings-delete" className="text-[13px] font-bold text-muted-foreground">
        데이터 전체 삭제
      </h2>
      <div className="flex min-w-0 flex-col gap-3 rounded-card border border-danger/30 bg-surface p-4 md:p-5">
        <p className="font-bold">삭제 전에 데이터를 내보내 두세요</p>
        <p className="text-sm text-muted-foreground">
          아이 정보와 모든 기록·사진이 삭제돼요. 로그인 계정은 남아요. JSON 백업에는 사진 파일이
          포함되지 않으므로 삭제한 사진은 JSON만으로 복구할 수 없어요.
        </p>
        {failure?.action === 'export' && (
          <ErrorBanner
            message={failure.message}
            onRetry={() => void download()}
            retrying={pending !== null}
          />
        )}
        <Button
          type="button"
          variant="soft"
          disabled={pending !== null}
          onClick={() => void download()}
        >
          <Download aria-hidden />
          {pending === 'export' ? '내보내는 중…' : '삭제 전 백업 내려받기'}
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={pending !== null}
          onClick={() => changeOpen(true)}
        >
          <Trash2 aria-hidden />
          데이터 전체 삭제
        </Button>
      </div>
      <AlertDialog open={open} onOpenChange={changeOpen}>
        <AlertDialogContent
          onEscapeKeyDown={(event) => {
            if (busy.current) event.preventDefault()
          }}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void remove()
            }}
            className="flex min-w-0 flex-col gap-4"
          >
            <AlertDialogHeader>
              <AlertDialogTitle>모든 기록과 사진을 삭제할까요?</AlertDialogTitle>
              <AlertDialogDescription>
                아이 정보·성장·수면·음식·식단·레시피·사진이 모두 삭제돼요. 로그인 계정은 남으며,
                삭제 후 아이 정보 등록 화면으로 이동해요.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <label htmlFor="delete-confirm" className="text-sm font-bold">
              확인을 위해 ‘삭제’를 입력해 주세요
            </label>
            <Input
              id="delete-confirm"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="삭제"
              autoComplete="off"
              spellCheck={false}
              maxLength={20}
              disabled={pending !== null}
            />
            {failure?.action === 'delete' && <ErrorBanner message={failure.message} />}
            {pending === 'delete' && (
              <p role="status" className="text-sm text-muted-foreground">
                사진과 기록을 삭제하는 중이에요…
              </p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel type="button" disabled={pending !== null}>
                취소
              </AlertDialogCancel>
              <AlertDialogAction
                type="submit"
                variant="destructive"
                disabled={keyword !== '삭제' || pending !== null}
                onClick={(event) => {
                  event.preventDefault()
                  void remove()
                }}
              >
                {pending === 'delete'
                  ? '삭제하는 중…'
                  : failure?.action === 'delete'
                    ? '다시 삭제 시도'
                    : '모두 삭제'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
