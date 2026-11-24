import { Link } from 'react-router'
import { ChevronRight, ClipboardCheck } from 'lucide-react'
import { ErrorBanner } from '@/components/ErrorBanner'
import { useShoppingItems } from '@/lib/useShopping'
import { useTasks } from '@/lib/useTasks'
import { HomeCard } from './HomeCard'

export function ShoppingCard() {
  const shopping = useShoppingItems(),
    tasks = useTasks()
  const ready = shopping.isSuccess && tasks.isSuccess
  const failed = shopping.isError || tasks.isError
  const summary = `할 일 ${tasks.data?.filter((item) => !item.completed).length ?? 0}개 · 살 물건 ${shopping.data?.filter((item) => item.status === 'pending').length ?? 0}개`
  return (
    <HomeCard title="준비 목록" icon={ClipboardCheck}>
      {failed ? (
        <ErrorBanner
          message="준비 목록을 불러오지 못했어요"
          retrying={shopping.isFetching || tasks.isFetching}
          onRetry={() => {
            if (shopping.isError) void shopping.refetch()
            if (tasks.isError) void tasks.refetch()
          }}
        />
      ) : !ready ? (
        <p className="text-sm text-muted-foreground">불러오는 중…</p>
      ) : null}
      <Link
        to="/preparation"
        aria-label={ready ? `준비 목록 보기, ${summary}` : '준비 목록 보기'}
        className="flex min-h-11 flex-wrap items-center gap-0.5 self-start text-sm font-bold text-soft-text outline-none hover:underline focus-visible:underline"
      >
        {ready ? (
          <>
            <span>할 일 {tasks.data.filter((item) => !item.completed).length}개</span>
            <span className="px-1 text-muted-foreground" aria-hidden>
              ·
            </span>
            <span>
              살 물건 {shopping.data.filter((item) => item.status === 'pending').length}개
            </span>
          </>
        ) : (
          '준비 목록 보기'
        )}
        <ChevronRight className="size-4" aria-hidden />
      </Link>
    </HomeCard>
  )
}
