import { Link } from 'react-router'
import { ChevronRight, ShoppingBag } from 'lucide-react'
import { useShoppingItems } from '@/lib/useShopping'
import { HomeCard } from './HomeCard'

export function ShoppingCard() {
  const query = useShoppingItems()
  const count = query.data?.filter((item) => item.status === 'pending').length ?? 0
  return (
    <HomeCard title="쇼핑 목록" icon={ShoppingBag}>
      {query.isPending ? (
        <p className="text-sm text-muted-foreground">불러오는 중…</p>
      ) : query.isError ? (
        <p className="text-sm text-muted-foreground">목록을 불러오지 못했어요</p>
      ) : count > 0 ? (
        <p className="text-sm text-muted-foreground">
          살 물건 <strong className="font-bold text-foreground">{count}개</strong>
        </p>
      ) : null}
      <Link
        to="/shopping"
        className="flex min-h-11 items-center gap-0.5 self-start text-sm font-bold text-soft-text outline-none hover:underline focus-visible:underline"
      >
        쇼핑 목록 보기
        <ChevronRight className="size-4" aria-hidden />
      </Link>
    </HomeCard>
  )
}
