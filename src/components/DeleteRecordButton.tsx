import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from './ConfirmDialog'

/** 수정 화면 하단 삭제 버튼 (FR-COM-31). 누르면 삭제 확인 창을 거친다 (기능요구사항서 3.4) */
export function DeleteRecordButton({
  onConfirm,
  pending = false,
}: {
  onConfirm: () => void
  /** 삭제 요청 중이면 버튼을 잠근다 */
  pending?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" variant="destructive" disabled={pending} onClick={() => setOpen(true)}>
        {pending ? '삭제하는 중…' : '삭제'}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="이 기록을 삭제할까요?"
        description="삭제하면 되돌릴 수 없어요"
        confirmLabel="삭제"
        destructive
        onConfirm={onConfirm}
      />
    </>
  )
}
