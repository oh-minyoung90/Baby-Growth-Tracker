import { Link } from 'react-router'
import { ChevronRight, ShoppingBag } from 'lucide-react'
import { useShoppingItems } from '@/lib/useShopping'
import { HomeCard } from './HomeCard'

export function ShoppingCard() {
  const query = useShoppingItems()
  const count = query.data?.filter((item) => item.status === 'pending').length ?? 0
  const summary = `살 물건 ${count}개`
  return (
    <HomeCard title="사야 할 물건" icon={ShoppingBag}>
      {query.isPending ? (
        <p className="text-sm text-muted-foreground">불러오는 중…</p>
      ) : query.isError ? (
        <p className="text-sm text-muted-foreground">목록을 불러오지 못했어요</p>
      ) : null}
      <Link
        to="/shopping"
        aria-label={query.isSuccess ? `사야 할 물건 보기, ${summary}` : '사야 할 물건 보기'}
        className="flex min-h-11 items-center gap-0.5 self-start text-sm font-bold text-soft-text outline-none hover:underline focus-visible:underline"
      >
        {query.isSuccess ? summary : '사야 할 물건 보기'}
        <ChevronRight className="size-4" aria-hidden />
      </Link>
    </HomeCard>
  )
}
