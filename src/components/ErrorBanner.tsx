import { WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NETWORK_ERROR_MESSAGES } from '@/lib/messages'

/**
 * 네트워크 오류 안내 (기능요구사항서 3.4, 3.7): 화면 상단 배너 + 다시 시도 버튼.
 * 입력 중인 내용은 지우지 않는다 (배너를 띄우는 화면이 폼 값을 그대로 둔다).
 */
export function ErrorBanner({
  message = NETWORK_ERROR_MESSAGES.save,
  onRetry,
  retrying = false,
}: {
  message?: string
  onRetry?: () => void
  retrying?: boolean
}) {
  return (
    <div
      role="alert"
      className="flex items-center gap-2.5 rounded-button bg-danger-soft px-3.5 py-3 text-sm text-danger-text"
    >
      <WifiOff className="size-5 shrink-0" aria-hidden />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <Button type="button" variant="destructive" size="sm" disabled={retrying} onClick={onRetry}>
          다시 시도
        </Button>
      )}
    </div>
  )
}
