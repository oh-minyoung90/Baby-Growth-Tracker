import { Link } from 'react-router'
import { Settings } from 'lucide-react'
import { useShoppingNavigation } from '@/lib/shoppingNavigation'
/** 하단 설정 탭 대신 쇼핑을 표시할 때 모든 기본 화면에서 설정에 접근한다. */
export function ShoppingSettingsLink() {
  const [enabled] = useShoppingNavigation()
  return enabled ? (
    <Link
      to="/settings"
      aria-label="설정"
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-input text-soft-text outline-none hover:bg-soft focus-visible:ring-3 focus-visible:ring-ring/40 md:hidden"
    >
      <Settings className="size-5" aria-hidden />
    </Link>
  ) : null
}
