import { Link } from 'react-router'
import { ChevronRight, ShoppingBag } from 'lucide-react'
import { useShoppingItems } from '@/lib/useShopping'
export function ShoppingShortcut() {
  const query = useShoppingItems()
  return (
    <Link
      to="/shopping"
      className="flex min-h-13 items-center gap-2 rounded-button border bg-surface px-3.5 py-3 text-sm font-bold text-soft-text outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
    >
      <ShoppingBag className="size-5" aria-hidden />
      쇼핑 리스트
      <span className="ml-auto text-xs font-normal text-muted-foreground">
        {query.isSuccess
          ? `살 물건 ${query.data.filter((item) => item.status === 'pending').length}개`
          : query.isError
            ? '목록 확인'
            : '불러오는 중…'}
      </span>
      <ChevronRight className="size-4" aria-hidden />
    </Link>
  )
}
