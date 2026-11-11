import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Utensils } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { ErrorBanner } from '@/components/ErrorBanner'
import { ListLoading } from '@/components/ListLoading'
import { Button } from '@/components/ui/button'
import { isValidDateString, todayString } from '@/domain/date'
import { shiftMealWeek, weekFromParam } from '@/domain/mealWeek'
import { NETWORK_ERROR_MESSAGES } from '@/lib/messages'
import { isMealType } from '@/lib/mealTypes'
import { useChild } from '@/lib/useChild'
import { useMealEntry, useMealWeek } from '@/lib/useMeals'
import { useSheetParam } from '@/lib/useSheetParam'
import { MealWeekBoard } from './MealWeekBoard'
import { MealSheet, type MealEditor } from './MealSheet'

export function MealWeekPage() {
  const [params, setParams] = useSearchParams()
  const sheet = useSheetParam('record', ['date', 'meal'])
  const child = useChild()
  const today = todayString()
  const editing = sheet.value !== null && sheet.value !== 'new'
  const single = useMealEntry(editing && sheet.value ? sheet.value : undefined)
  const newDate = params.get('date') ?? today
  const typeParam = params.get('meal') ?? 'breakfast'
  const newType = isMealType(typeParam) ? typeParam : null
  const week = weekFromParam(params.get('week') ?? single.data?.date ?? params.get('date'), today)
  const meals = useMealWeek(week.start, week.end)
  const editor = useMemo<MealEditor | null>(() => {
    if (sheet.value === 'new')
      return isValidDateString(newDate) && newType ? { date: newDate, type: newType } : null
    return single.data
      ? { date: single.data.date, type: single.data.type, initial: single.data }
      : null
  }, [sheet.value, newDate, newType, single.data])
  const [view, setView] = useState(0)
  const changeWeek = (date: string) => {
    const next = new URLSearchParams(params)
    next.set('week', date)
    next.delete('record')
    setParams(next)
  }
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="이전 주"
            onClick={() => changeWeek(shiftMealWeek(week.start, -1))}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <h2 className="text-[15px] font-bold tabular-nums md:text-lg">{week.label}</h2>
          <Button
            variant="ghost"
            size="icon"
            aria-label="다음 주"
            onClick={() => changeWeek(shiftMealWeek(week.start, 1))}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
        <Button
          variant="soft"
          size="sm"
          onClick={() => {
            changeWeek(today)
            setView((value) => value + 1)
          }}
        >
          이번 주
        </Button>
      </div>
      {meals.isPending ? (
        <ListLoading />
      ) : meals.isError ? (
        <ErrorBanner
          message={NETWORK_ERROR_MESSAGES.load}
          onRetry={() => void meals.refetch()}
          retrying={meals.isFetching}
        />
      ) : (
        <>
          {meals.data.length === 0 && (
            <EmptyState
              icon={Utensils}
              title="이번 주 식단을 계획해 보세요"
              description="요일별로 아침·점심·저녁·간식을 기록할 수 있어요"
            />
          )}
          <MealWeekBoard
            key={`${week.start}:${view}`}
            days={week.days}
            today={today}
            entries={meals.data}
            onSelect={(date, type, entry) =>
              sheet.open(entry?.id ?? 'new', entry ? {} : { params: { date, meal: type } })
            }
          />
        </>
      )}
      <MealSheet
        open={sheet.value !== null}
        editor={editor}
        editing={editing}
        loading={editing && !!sheet.value && single.isPending}
        failed={editing && single.isError}
        onRetry={() => void single.refetch()}
        birthDate={child.data?.birthDate}
        onClose={sheet.close}
      />
    </div>
  )
}
