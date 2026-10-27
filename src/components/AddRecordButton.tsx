import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * 목록 화면의 기록 추가 버튼 (docs/디자인.md 5장).
 * - 모바일: 오른쪽 아래 떠 있는 60px 버튼 (하단 탭 위 20px). 글자는 화면 낭독기에만 읽힌다.
 * - PC: 놓인 자리에 아이콘과 글자를 함께 보여 준다.
 */
export function AddRecordButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      onClick={onClick}
      className="fixed right-5 bottom-[calc(96px+env(safe-area-inset-bottom))] z-30 size-15 rounded-[20px] shadow-lg shadow-primary/35 md:static md:h-12 md:w-auto md:rounded-button md:px-5 md:shadow-none"
    >
      <Plus className="size-7 md:size-5" aria-hidden />
      <span className="sr-only md:not-sr-only">{label}</span>
    </Button>
  )
}
