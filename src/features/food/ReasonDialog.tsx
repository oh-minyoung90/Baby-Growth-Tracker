import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { ErrorBanner } from '@/components/ErrorBanner'
import { TextField } from '@/components/form/TextField'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { CautionSaveError } from '@/lib/foodApi'
import { MEMO_MAX, reasonSchema, serverCautionFieldError } from './foodSchema'

/**
 * 사유(선택)를 받는 확인 창: 알러지·주의 해제, "주의" 태그 해제 (FR-FOOD-12~13).
 * 실행 버튼을 눌러도 바로 닫지 않는다. 저장되면 부르는 화면이 시트째 닫고, 실패하면 창 안에서 알린다
 */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pending,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  pending: boolean
  /** 실패하면 오류를 던진다 (CautionSaveError) */
  onConfirm: (reason: string | null) => Promise<void>
}) {
  return (
    // 저장하는 동안에는 닫지 않는다
    <AlertDialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <AlertDialogContent>
        {/* 창을 열 때마다 사유 입력을 새로 시작한다 (닫히면 내용이 사라짐) */}
        <ReasonForm
          title={title}
          description={description}
          confirmLabel={confirmLabel}
          pending={pending}
          onConfirm={onConfirm}
        />
      </AlertDialogContent>
    </AlertDialog>
  )
}

function ReasonForm({
  title,
  description,
  confirmLabel,
  pending,
  onConfirm,
}: Omit<Parameters<typeof ReasonDialog>[0], 'open' | 'onOpenChange'>) {
  const [failed, setFailed] = useState(false)
  const { control, handleSubmit, setError } = useForm({
    resolver: zodResolver(reasonSchema),
    defaultValues: { reason: '' },
  })

  const onSubmit = handleSubmit(async ({ reason }) => {
    setFailed(false)
    try {
      await onConfirm(reason)
    } catch (error) {
      const fieldError = serverCautionFieldError(
        error instanceof CautionSaveError ? error.reason : 'network',
      )
      if (fieldError?.field === 'reason') setError('reason', { message: fieldError.message })
      else setFailed(true)
    }
  })

  return (
    <form
      onSubmit={(event) => {
        // 창은 화면 밖(Portal)에 그려지지만 React 이벤트는 부른 쪽으로 올라간다.
        // 음식 수정 폼 안에서 열리므로, 여기서 막지 않으면 수정 폼까지 저장된다
        event.stopPropagation()
        void onSubmit(event)
      }}
      noValidate
      className="grid gap-4"
    >
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>
      {/* 다시 시도는 아래 실행 버튼으로 한다 */}
      {failed && <ErrorBanner />}
      <TextField
        control={control}
        name="reason"
        id="reason-dialog-reason"
        label="사유 (선택)"
        placeholder="예: 소아과에서 다시 먹여 봐도 된다고 했어요"
        maxLength={MEMO_MAX}
        multiline
      />
      <AlertDialogFooter className="mt-0">
        <AlertDialogCancel disabled={pending}>취소</AlertDialogCancel>
        <Button type="submit" disabled={pending}>
          {pending ? `${confirmLabel}하는 중…` : confirmLabel}
        </Button>
      </AlertDialogFooter>
    </form>
  )
}
