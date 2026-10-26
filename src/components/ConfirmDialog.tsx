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

/**
 * 앱 자체 확인 창 (기능요구사항서 3.4): 가운데 카드, 제목 + 설명 + 왼쪽 취소 · 오른쪽 실행.
 * 브라우저 기본 confirm()은 쓰지 않는다. 실행 버튼을 누르면 창이 닫히고 onConfirm이 불린다.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = '취소',
  destructive = false,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel: string
  cancelLabel?: string
  /** 삭제처럼 되돌릴 수 없는 실행이면 코랄 버튼으로 표시한다 */
  destructive?: boolean
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {/* 설명이 없어도 접근성 경고가 나지 않도록 빈 설명을 둔다 */}
          <AlertDialogDescription className={description ? undefined : 'sr-only'}>
            {description ?? title}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction variant={destructive ? 'destructive' : 'default'} onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
