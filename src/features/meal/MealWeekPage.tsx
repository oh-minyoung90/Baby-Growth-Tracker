import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Utensils } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { ErrorBanner } from '@/components/ErrorBanner'
import { ListLoading } from '@/components/ListLoading'
import { Button } from '@/components/ui/button'
import { formatDateLabel, isValidDateString, todayString } from '@/domain/date'
import { shiftMealWeek, weekFromParam } from '@/domain/mealWeek'
import { NETWORK_ERROR_MESSAGES } from '@/lib/messages'
import { mealCautionFoods, mealCautionMessage } from '@/lib/mealCaution'
import { MealSaveError, type MealEntry, type MealMoveTarget } from '@/lib/mealApi'
import { notifyDone } from '@/lib/notify'
import { notifyMealSaved } from '@/lib/mealNotify'
import { useFoods } from '@/lib/useFoods'
import { isMealType, mealTypeLabel } from '@/lib/mealTypes'
import { useChild } from '@/lib/useChild'
import {
  useMealEntry,
  useMealWeek,
  useSetMealEaten,
  useMoveMeal,
  useCopyMeal,
} from '@/lib/useMeals'
import { useSheetParam } from '@/lib/useSheetParam'
import { MEAL_MESSAGES } from './mealSchema'
import { MealMoveSheet } from './MealMoveSheet'
import { FUTURE_MOVE_TITLE, futureMoveDescription, mealMoveError } from './mealMove'
import { MealWeekBoard } from './MealWeekBoard'
import { MealSheet, type MealEditor } from './MealSheet'

export function MealWeekPage() {
  const [params, setParams] = useSearchParams()
  const sheet = useSheetParam('record', ['date', 'meal'])
  const child = useChild()
  const foods = useFoods()
  const setEaten = useSetMealEaten()
  const move = useMoveMeal()
  const copy = useCopyMeal()
  const [copying, setCopying] = useState<MealEntry | null>(null)
  const [moving, setMoving] = useState<MealEntry | null>(null)
  const [futureDrop, setFutureDrop] = useState<{ entry: MealEntry; target: MealMoveTarget } | null>(
    null,
  )
  const [failedMove, setFailedMove] = useState<{
    entry: MealEntry
    target: MealMoveTarget
    error: unknown
  } | null>(null)
  const [focusDate, setFocusDate] = useState<string>()
  const [confirmation, setConfirmation] = useState<MealEntry | null>(null)
  const [failedCheck, setFailedCheck] = useState<{
    entry: MealEntry
    eaten: boolean
    message: string
    retryable: boolean
  } | null>(null)
  const warningsReady = foods.isSuccess && !foods.isFetching
  const changeEaten = async (entry: MealEntry, eaten: boolean) => {
    if (copy.isPending || move.isPending || setEaten.isPending || (eaten && !warningsReady)) return
    setFailedCheck(null)
    try {
      const result = await setEaten.mutateAsync({ id: entry.id, eaten })
      notifyMealSaved(result)
    } catch (error) {
      const message =
        error instanceof MealSaveError && error.reason === 'futureDate'
          ? MEAL_MESSAGES.futureEaten
          : error instanceof MealSaveError && error.reason === 'notFound'
            ? MEAL_MESSAGES.notFound
            : NETWORK_ERROR_MESSAGES.save
      setFailedCheck({
        entry,
        eaten,
        message,
        retryable: !(error instanceof MealSaveError) || error.reason === 'network',
      })
    }
  }
  const today = todayString()
  const editing = sheet.value !== null && sheet.value !== 'new'
  const single = useMealEntry(editing && sheet.value ? sheet.value : undefined)
  const newDate = params.get('date') ?? today
  const typeParam = params.get('meal') ?? 'breakfast'
  const newType = isMealType(typeParam) ? typeParam : null
  const week = weekFromParam(params.get('week') ?? single.data?.date ?? params.get('date'), today)
  const meals = useMealWeek(week.start, week.end)
  const requestEatenChange = (entry: MealEntry, eaten: boolean) => {
    if (copy.isPending || move.isPending || setEaten.isPending || (eaten && !warningsReady)) return
    const current = meals.data?.find((item) => item.id === entry.id) ?? entry
    if (eaten && mealCautionFoods(current.foods, current.recipes, foods.data ?? []).length > 0)
      setConfirmation(current)
    else void changeEaten(current, eaten)
  }
  const editor = useMemo<MealEditor | null>(() => {
    if (sheet.value === 'new')
      return isValidDateString(newDate) && newType ? { date: newDate, type: newType } : null
    return single.data
      ? { date: single.data.date, type: single.data.type, initial: single.data }
      : null
  }, [sheet.value, newDate, newType, single.data])
  const [view, setView] = useState(0)
  const showTarget = (target: MealMoveTarget) => {
    const next = new URLSearchParams(params)
    next.set('week', weekFromParam(target.date, today).start)
    next.delete('record')
    setParams(next, { replace: true })
    setFocusDate(target.date)
    setView((value) => value + 1)
  }
  const performCopy = async (entry: MealEntry, target: MealMoveTarget) => {
    if (copy.isPending || move.isPending || setEaten.isPending || !warningsReady) return
    await copy.mutateAsync({ id: entry.id, target })
    setCopying(null)
    showTarget(target)
    notifyDone(
      `${formatDateLabel(target.date)} ${mealTypeLabel(target.type)}에 새 계획으로 복사했어요`,
    )
  }
  const performMove = async (entry: MealEntry, target: MealMoveTarget, uncheck: boolean) => {
    if (copy.isPending || move.isPending || setEaten.isPending) return
    await move.mutateAsync({ id: entry.id, target, uncheck })
    setMoving(null)
    setFailedMove(null)
    showTarget(target)
    notifyDone(`${formatDateLabel(target.date)} ${mealTypeLabel(target.type)}으로 식단을 옮겼어요`)
  }
  const dropMove = (entry: MealEntry, target: MealMoveTarget) => {
    if (copy.isPending || move.isPending || setEaten.isPending) return
    if (child.data?.birthDate && target.date < child.data.birthDate) {
      setFailedMove({ entry, target, error: new MealSaveError('beforeBirth') })
      return
    }
    setFailedMove(null)
    if (entry.eaten && target.date > todayString()) setFutureDrop({ entry, target })
    else
      void performMove(entry, target, false).catch((error) =>
        setFailedMove({ entry, target, error }),
      )
  }
  const changeWeek = (date: string) => {
    setFocusDate(undefined)
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
      {failedMove && (
        <ErrorBanner
          message={mealMoveError(failedMove.error)}
          onRetry={
            !(failedMove.error instanceof MealSaveError) || failedMove.error.reason === 'network'
              ? () => dropMove(failedMove.entry, failedMove.target)
              : undefined
          }
          retrying={move.isPending}
        />
      )}
      {foods.isError && (
        <ErrorBanner
          message="주의 음식 정보를 불러오지 못했어요. 다시 시도해 주세요."
          onRetry={() => void foods.refetch()}
          retrying={foods.isFetching}
        />
      )}
      {failedCheck && (
        <ErrorBanner
          message={failedCheck.message}
          onRetry={
            failedCheck.retryable
              ? () => requestEatenChange(failedCheck.entry, failedCheck.eaten)
              : undefined
          }
          retrying={setEaten.isPending || (failedCheck.eaten && !warningsReady)}
        />
      )}
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
            pendingId={
              copy.isPending
                ? copy.variables.id
                : move.isPending
                  ? move.variables.id
                  : setEaten.isPending
                    ? setEaten.variables.id
                    : undefined
            }
            focusDate={focusDate}
            onMove={(entry) => setMoving(entry)}
            onCopy={(entry) => {
              if (warningsReady) setCopying(entry)
            }}
            onDropMove={(entry, date, type) => dropMove(entry, { date, type })}
            warningsReady={warningsReady}
            cautionIds={
              new Set(
                meals.data
                  .filter(
                    (entry) =>
                      mealCautionFoods(entry.foods, entry.recipes, foods.data ?? []).length > 0,
                  )
                  .map((entry) => entry.id),
              )
            }
            onEatenChange={requestEatenChange}
            onSelect={(date, type, entry) =>
              sheet.open(entry?.id ?? 'new', entry ? {} : { params: { date, meal: type } })
            }
          />
        </>
      )}
      <ConfirmDialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null)
        }}
        title={mealCautionMessage(
          confirmation
            ? mealCautionFoods(confirmation.foods, confirmation.recipes, foods.data ?? [])
            : [],
        )}
        description="음식을 확인한 후 먹음으로 저장해 주세요."
        confirmLabel="그래도 저장"
        onConfirm={() => {
          if (confirmation) void changeEaten(confirmation, true)
        }}
      />
      <ConfirmDialog
        open={futureDrop !== null}
        onOpenChange={(open) => {
          if (!open) setFutureDrop(null)
        }}
        title={FUTURE_MOVE_TITLE}
        description={futureDrop ? futureMoveDescription(futureDrop.target) : undefined}
        confirmLabel="체크 해제하고 이동"
        onConfirm={() => {
          if (futureDrop)
            void performMove(futureDrop.entry, futureDrop.target, true).catch((error) =>
              setFailedMove({ ...futureDrop, error }),
            )
        }}
      />
      {moving && (
        <MealMoveSheet
          key={moving.id}
          entry={moving}
          birthDate={child.data?.birthDate}
          pending={move.isPending}
          onMove={performMove}
          onClose={() => setMoving(null)}
        />
      )}
      {copying && (
        <MealMoveSheet
          key={`copy:${copying.id}`}
          mode="copy"
          entry={copying}
          birthDate={child.data?.birthDate}
          pending={copy.isPending}
          onMove={performCopy}
          onClose={() => setCopying(null)}
          cautionFoods={mealCautionFoods(copying.foods, copying.recipes, foods.data ?? [])}
          warningsReady={warningsReady}
          cautionFailed={foods.isError}
          onRetryCaution={() => void foods.refetch()}
        />
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
