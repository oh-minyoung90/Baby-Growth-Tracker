import { useState } from 'react'
import { Link } from 'react-router'
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Link as LinkIcon,
  Plus,
} from 'lucide-react'
import { ErrorBanner } from '@/components/ErrorBanner'
import { ListLoading } from '@/components/ListLoading'
import { Checkbox } from '@/components/ui/checkbox'
import { formatDateLabel } from '@/domain/date'
import { NETWORK_ERROR_MESSAGES } from '@/lib/messages'
import type { PreparationTask } from '@/lib/taskApi'
import { useTasks, useSetTaskCompleted } from '@/lib/useTasks'
import { cn } from '@/lib/utils'

export function TasksPage() {
  const query = useTasks(),
    change = useSetTaskCompleted()
  const [failed, setFailed] = useState<{ id: string; completed: boolean } | null>(null)
  const pending = (query.data ?? []).filter((item) => !item.completed)
  const completed = (query.data ?? []).filter((item) => item.completed)
  const update = async (action: { id: string; completed: boolean }) => {
    if (change.isPending) return
    setFailed(null)
    try {
      await change.mutateAsync(action)
    } catch {
      setFailed(action)
    }
  }
  const rows = (items: PreparationTask[]) => (
    <ul className="divide-y overflow-hidden rounded-card border bg-surface">
      {items.map((item) => (
        <li key={item.id} className="flex min-w-0 items-start gap-3 p-4">
          <label className="flex h-11 w-11 shrink-0 items-center justify-center">
            <Checkbox
              checked={item.completed}
              disabled={change.isPending}
              aria-label={`${item.name} 완료`}
              onCheckedChange={(checked) =>
                void update({ id: item.id, completed: checked === true })
              }
            />
          </label>
          <div className="min-w-0 flex-1">
            <Link
              to={`/preparation/tasks/${item.id}/edit`}
              className="flex min-h-11 flex-col gap-1 rounded-sm py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              <span
                className={cn(
                  'text-[15px] font-bold break-words',
                  item.completed && 'text-muted-foreground line-through',
                )}
              >
                {item.name}
              </span>
              {item.memo && (
                <span className="text-[13px] break-words text-muted-foreground">{item.memo}</span>
              )}
              {item.dueDate && (
                <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="size-3.5 shrink-0" aria-hidden />
                  {formatDateLabel(item.dueDate)}까지
                </span>
              )}
            </Link>
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 max-w-full items-center gap-1 text-xs font-medium text-soft-text underline-offset-4 hover:underline"
              >
                <LinkIcon className="size-3.5" aria-hidden />
                관련 링크
                <ExternalLink className="size-3" aria-hidden />
                <span className="sr-only"> (새 탭)</span>
              </a>
            )}
          </div>
          <ChevronRight className="mt-3 size-4 shrink-0 text-muted-foreground" aria-hidden />
        </li>
      ))}
    </ul>
  )
  return (
    <section aria-label="할 일 목록" className="flex min-w-0 flex-col gap-4">
      {query.isPending ? (
        <ListLoading />
      ) : query.isError ? (
        <ErrorBanner
          message={NETWORK_ERROR_MESSAGES.load}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : (
        <>
          {failed && (
            <ErrorBanner onRetry={() => void update(failed)} retrying={change.isPending} />
          )}
          <p className="text-[13px] text-muted-foreground" aria-live="polite">
            할 일 {pending.length}개
          </p>
          {pending.length ? (
            rows(pending)
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {completed.length
                ? '해야 할 일을 모두 마쳤어요'
                : '아이를 위해 해야 할 일을 적어 보세요'}
            </p>
          )}
          <Link
            to="/preparation/tasks/new"
            className="flex min-h-12 items-center justify-center gap-2 rounded-button border bg-soft px-4 text-sm font-bold text-soft-text outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            <Plus className="size-5" aria-hidden />할 일 추가
          </Link>
          <details className="group border-t pt-3">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/40 [&::-webkit-details-marker]:hidden">
              완료한 일 {completed.length}개
              <ChevronDown className="size-4 group-open:rotate-180" aria-hidden />
            </summary>
            {completed.length ? (
              rows(completed)
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">완료한 일이 없어요</p>
            )}
          </details>
        </>
      )}
    </section>
  )
}
