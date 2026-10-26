import { toast } from 'sonner'

/** 저장 성공 알림: 화면 아래 가운데, 2초 (기능요구사항서 3.4). 모양은 components/ui/sonner.tsx */
export function notifySaved(): void {
  toast.success('저장했어요')
}
