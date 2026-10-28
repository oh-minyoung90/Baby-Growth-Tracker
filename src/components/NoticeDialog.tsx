import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

/**
 * 앱 자체 안내 창 (기능요구사항서 3.4): 확인 창과 같은 가운데 카드에 [확인] 버튼 하나.
 * 고를 것이 없고 알리기만 할 때 쓴다. 버튼을 누르면 창이 닫히기만 한다.
 */
export function NoticeDialog({
  open,
  onOpenChange,
  title,
  description,
  closeLabel = '확인',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  closeLabel?: string
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
        <AlertDialogFooter className="grid-cols-1">
          <AlertDialogAction>{closeLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
