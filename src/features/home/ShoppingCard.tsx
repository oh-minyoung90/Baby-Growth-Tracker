import { Link } from 'react-router'
import { ChevronRight, ShoppingBag } from 'lucide-react'
import { useShoppingItems } from '@/lib/useShopping'
import { HomeCard } from './HomeCard'

export function ShoppingCard() {
  const query = useShoppingItems()
  const items = query.data?.filter((item) => item.status === 'pending') ?? []
  return (
    <HomeCard title="사야 할 물건" icon={ShoppingBag}>
      {query.isPending ? (
        <p className="text-sm text-muted-foreground">불러오는 중…</p>
      ) : query.isError ? (
        <p className="text-sm text-muted-foreground">목록을 불러오지 못했어요</p>
      ) : items.length > 0 ? (
        <ul className="flex min-w-0 flex-col gap-2">
          {items.map((item) => (
            <li key={item.id} className="min-w-0">
              <Link
                to={`/shopping/${item.id}/edit`}
                className="flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-input py-1.5 text-[15px] font-medium outline-none hover:bg-muted focus-visible:bg-muted"
              >
                <span className="min-w-0 break-words">{item.name}</span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <Link
        to="/shopping"
        className="flex min-h-11 items-center gap-0.5 self-start text-sm font-bold text-soft-text outline-none hover:underline focus-visible:underline"
      >
        사야 할 물건 보기
        <ChevronRight className="size-4" aria-hidden />
      </Link>
    </HomeCard>
  )
}
