import { toast } from 'sonner'

/** 저장 성공 알림: 화면 아래 가운데, 2초 (기능요구사항서 3.4). 모양은 components/ui/sonner.tsx */
export function notifySaved(): void {
  toast.success('저장했어요')
}

/** 저장 외의 완료 알림 (예: "기본 음식 42개를 추가했어요"). 모양과 시간은 저장 알림과 같다 */
export function notifyDone(message: string): void {
  toast.success(message)
}
