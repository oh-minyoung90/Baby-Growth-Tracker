import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ChevronDown, ChevronRight, Link as LinkIcon, Plus, Star } from 'lucide-react'
import { ChoiceChips } from '@/components/ChoiceChips'
import { ErrorBanner } from '@/components/ErrorBanner'
import { ListLoading } from '@/components/ListLoading'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import type { ShoppingItem } from '@/lib/shoppingApi'
import { SHOPPING_CATEGORIES } from '@/lib/shoppingTypes'
import { useShoppingItems, useSetShoppingStatus } from '@/lib/useShopping'
import { NETWORK_ERROR_MESSAGES } from '@/lib/messages'
import { cn } from '@/lib/utils'

export function ShoppingPage() {
  const query = useShoppingItems()
  const change = useSetShoppingStatus()
  const [params, setParams] = useSearchParams()
  const [failed, setFailed] = useState<{ id: string; status: 'pending' | 'purchased' } | null>(null)
  const frequent = params.get('tab') === 'frequent'
  const category = SHOPPING_CATEGORIES.some((c) => c.value === params.get('category'))
    ? params.get('category')!
    : 'all'
  const items = query.data ?? []
  const pending = items.filter((item) => item.status === 'pending')
  const saved = items.filter((item) => item.frequent)
  const selected = (frequent ? saved : pending).filter(
    (item) => category === 'all' || item.category === category,
  )
  const completed = items.filter(
    (item) => item.status === 'purchased' && (category === 'all' || item.category === category),
  )
  const newPath = `/shopping/new${frequent ? '?frequent=1' : ''}`
  const setParam = (key: string, value: string, defaultValue: string) => {
    const next = new URLSearchParams(params)
    if (value === defaultValue) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }
  const updateStatus = async (action: { id: string; status: 'pending' | 'purchased' }) => {
    if (change.isPending) return
    setFailed(null)
    try {
      await change.mutateAsync(action)
    } catch {
      setFailed(action)
    }
  }
  const rows = (values: ShoppingItem[], showRebuy = false) =>
    values.length ? (
      <ul className="divide-y overflow-hidden rounded-card border bg-surface">
        {values.map((item) => (
          <li
            key={item.id}
            className={cn('flex min-w-0 items-start gap-3 p-4', item.memo && item.url && 'pb-2')}
          >
            {!showRebuy && (
              <div className="flex h-11 w-6 shrink-0 items-center justify-center">
                <Checkbox
                  checked={item.status === 'purchased'}
                  disabled={change.isPending}
                  aria-label={`${item.name} 구매 완료`}
                  onCheckedChange={(checked) =>
                    void updateStatus({
                      id: item.id,
                      status: checked === true ? 'purchased' : 'pending',
                    })
                  }
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <Link
                to={`/shopping/${item.id}/edit`}
                className={cn(
                  'flex min-h-11 flex-col gap-1 rounded-sm py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/40',
                  !item.memo && !item.url && 'justify-center',
                )}
              >
                <span
                  className={cn(
                    'min-w-0 text-[15px] font-bold wrap-anywhere',
                    item.status === 'purchased' && !showRebuy && 'text-muted-foreground',
                  )}
                >
                  {item.name}
                  {item.frequent && (
                    <Star
                      className="ml-1 inline size-4 fill-type-food-icon text-type-food-icon-text"
                      aria-label="자주 사는 물건"
                    />
                  )}
                </span>
                {item.memo && (
                  <span className="text-xs wrap-anywhere whitespace-pre-line text-muted-foreground">
                    {item.memo}
                  </span>
                )}
              </Link>
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'inline-flex min-h-11 max-w-full gap-1 text-xs font-medium text-soft-text underline-offset-4 hover:underline',
                    item.memo ? 'items-start pt-1 [&>svg]:mt-px' : 'items-center',
                  )}
                >
                  <LinkIcon className="size-3.5" aria-hidden />
                  구매 링크
                  <span className="sr-only"> (새 탭)</span>
                </a>
              ) : item.status === 'purchased' && !showRebuy ? (
                <Link
                  to={`/shopping/${item.id}/edit`}
                  className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-soft-text"
                >
                  <LinkIcon className="size-3.5" aria-hidden />
                  구매 링크 추가
                </Link>
              ) : null}
            </div>
            {showRebuy ? (
              <Button
                type="button"
                size="sm"
                variant="soft"
                className="mt-1 min-h-11 shrink-0 px-2.5 text-xs"
                disabled={change.isPending || item.status === 'pending'}
                onClick={() => void updateStatus({ id: item.id, status: 'pending' })}
              >
                {item.status === 'pending' ? '목록에 있음' : '다시 담기'}
              </Button>
            ) : (
              <ChevronRight className="mt-3 size-4 shrink-0 text-muted-foreground" aria-hidden />
            )}
          </li>
        ))}
      </ul>
    ) : (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {category !== 'all'
          ? '이 카테고리에 등록된 물건이 없어요'
          : showRebuy
            ? '자주 사는 물건을 보관해 보세요'
            : '살 물건을 추가해 보세요'}
      </p>
    )
  return (
    <>
      <ChoiceChips
        label="물건 종류"
        options={[
          { value: 'todo', label: '살 물건' },
          { value: 'frequent', label: '자주 사는 물건' },
        ]}
        value={frequent ? 'frequent' : 'todo'}
        onChange={(value) => setParam('tab', value, 'todo')}
      />
      <ChoiceChips
        label="카테고리"
        options={[{ value: 'all', label: '전체' }, ...SHOPPING_CATEGORIES]}
        value={category}
        onChange={(value) => setParam('category', value, 'all')}
      />
      {query.isError && (
        <ErrorBanner
          message={NETWORK_ERROR_MESSAGES.load}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      )}
      {failed && (
        <ErrorBanner onRetry={() => void updateStatus(failed)} retrying={change.isPending} />
      )}
      <section
        id="shopping-panel"
        aria-label={frequent ? '자주 사는 물건' : '살 물건'}
        className="flex min-w-0 flex-col gap-4"
      >
        {query.isPending ? (
          <ListLoading />
        ) : (
          !query.isError && (
            <>
              <p className="text-[13px] text-muted-foreground" aria-live="polite">
                {frequent ? '보관한 물건' : '구매할 물건'} {selected.length}개
              </p>
              {rows(selected, frequent)}
              <Link
                to={newPath}
                className="flex min-h-12 items-center justify-center gap-2 rounded-button border bg-soft-hover px-4 text-sm font-bold text-soft-text outline-none transition-colors hover:bg-soft focus-visible:ring-3 focus-visible:ring-ring/40"
              >
                <Plus className="size-5" aria-hidden />
                {frequent ? '자주 사는 물건 추가' : '살 물건 추가'}
              </Link>
              {frequent ? (
                <p className="text-[13px] text-muted-foreground">
                  구매 링크를 보관하고, 필요할 때 다시 담으세요.
                </p>
              ) : (
                <details className="group border-t pt-3">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/40 [&::-webkit-details-marker]:hidden">
                    구매 완료 {completed.length}개
                    <ChevronDown className="size-4 group-open:rotate-180" aria-hidden />
                  </summary>
                  {completed.length ? (
                    rows(completed)
                  ) : (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      구매 완료한 물건이 없어요
                    </p>
                  )}
                </details>
              )}
            </>
          )
        )}
      </section>
    </>
  )
}
