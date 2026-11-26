import { Link } from 'react-router'
import { Settings } from 'lucide-react'
/** 홈과 아이 정보 헤더에서 환경 설정을 연다. */
export function MobileSettingsLink() {
  return (
    <Link
      to="/settings"
      aria-label="설정"
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-input text-muted-foreground outline-none hover:bg-soft-hover focus-visible:ring-3 focus-visible:ring-ring/40 md:hidden"
    >
      <Settings className="size-5" aria-hidden />
    </Link>
  )
}
