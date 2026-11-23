import { Link } from 'react-router'
import { ChevronRight, ShoppingBag } from 'lucide-react'
import { useShoppingNavigation } from '@/lib/shoppingNavigation'
export function ShoppingNavigationSection() {
  const [enabled, setEnabled] = useShoppingNavigation()
  return (
    <section
      aria-labelledby="settings-menu"
      className="flex flex-col gap-3 rounded-card border bg-surface p-4"
    >
      <h2 id="settings-menu" className="text-base font-bold">
        메뉴 설정
      </h2>
      <label className="flex min-h-11 items-center gap-4">
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <strong className="text-sm">하단 메뉴에 쇼핑 표시</strong>
          <span className="text-[13px] text-muted-foreground">
            자주 쓴다면 하단에서 바로 열 수 있어요
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          aria-label="하단 메뉴에 쇼핑 표시"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
          className="relative h-7 w-12 shrink-0 cursor-pointer appearance-none rounded-full bg-line before:absolute before:top-1 before:left-1 before:size-5 before:rounded-full before:bg-surface before:transition-transform checked:bg-primary checked:before:translate-x-5 focus-visible:ring-3 focus-visible:ring-ring/40"
        />
      </label>
      <p className="text-[13px] text-muted-foreground">
        {enabled
          ? '모바일에서 쇼핑을 켜면 설정은 화면 오른쪽 위 톱니바퀴로 이동해요.'
          : '꺼도 홈의 사야 할 물건 카드에서 열 수 있어요.'}{' '}
        선택은 이 브라우저에 저장돼요.
      </p>
      <p className="hidden text-[13px] text-muted-foreground md:block">
        PC 왼쪽 메뉴에는 쇼핑과 설정이 항상 표시돼요.
      </p>
      <Link
        to="/shopping"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-soft-text"
      >
        <ShoppingBag className="size-5" aria-hidden />
        사야 할 물건 열기
        <ChevronRight className="size-4" aria-hidden />
      </Link>
    </section>
  )
}
