import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useController, useForm } from 'react-hook-form'
import { z } from 'zod'
import { ChoiceChips } from '@/components/ChoiceChips'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ErrorBanner } from '@/components/ErrorBanner'
import { DateField } from '@/components/form/DateField'
import { FieldError } from '@/components/form/Field'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { formatDateLabel, todayString } from '@/domain/date'
import { MealSaveError, type MealEntry, type MealMoveTarget } from '@/lib/mealApi'
import { MEAL_TYPES, mealTypeLabel } from '@/lib/mealTypes'
import { recordDate } from '@/lib/validation'
import { FUTURE_MOVE_TITLE, futureMoveDescription, mealMoveError } from './mealMove'

export function MealMoveSheet({
  entry,
  birthDate,
  pending,
  onMove,
  onClose,
}: {
  entry: MealEntry
  birthDate?: string
  pending: boolean
  onMove: (entry: MealEntry, target: MealMoveTarget, uncheck: boolean) => Promise<void>
  onClose: () => void
}) {
  const [confirmation, setConfirmation] = useState<MealMoveTarget | null>(null)
  const [failure, setFailure] = useState<unknown>(null)
  const schema = z.object({
    date: recordDate({ birthDate, allowFuture: true }),
    type: z.enum(MEAL_TYPES.map((item) => item.value)),
  })
  const { control, handleSubmit } = useForm<MealMoveTarget>({
    resolver: zodResolver(schema),
    defaultValues: { date: entry.date, type: entry.type },
  })
  const type = useController({ control, name: 'type' })
  const persist = async (target: MealMoveTarget, uncheck: boolean) => {
    if (pending) return
    setFailure(null)
    try {
      await onMove(entry, target, uncheck)
    } catch (error) {
      setFailure(error)
    }
  }
  const submit = handleSubmit(async (target) => {
    if (pending) return
    setFailure(null)
    if (entry.eaten && target.date > todayString()) setConfirmation(target)
    else await persist(target, false)
  })
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
    >
      <SheetContent
        aria-describedby={undefined}
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault()
        }}
        onPointerDownOutside={(event) => {
          if (pending) event.preventDefault()
        }}
      >
        <SheetTitle>식단 이동</SheetTitle>
        <p className="text-sm text-muted-foreground">
          {formatDateLabel(entry.date)} · {mealTypeLabel(entry.type)}
          <br />
          {[...entry.foods, ...entry.recipes].map((item) => item.name).join(', ')}
        </p>
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          {failure !== null &&
            (failure instanceof MealSaveError && failure.reason !== 'network' ? (
              <FieldError>{mealMoveError(failure)}</FieldError>
            ) : (
              <ErrorBanner
                message={mealMoveError(failure)}
                onRetry={() => void submit()}
                retrying={pending}
              />
            ))}
          <fieldset disabled={pending} className="contents">
            <DateField
              control={control}
              name="date"
              label="옮길 날짜"
              min={birthDate}
              id="meal-move-date"
            />
            <div className="flex flex-col gap-2">
              <span className="text-sm font-bold">옮길 끼니</span>
              <ChoiceChips
                label="옮길 끼니"
                options={MEAL_TYPES.map((item) => ({ ...item }))}
                value={type.field.value}
                onChange={type.field.onChange}
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Button type="button" variant="soft" onClick={onClose}>
                취소
              </Button>
              <Button type="submit">{pending ? '옮기는 중…' : '이동'}</Button>
            </div>
          </fieldset>
        </form>
        <ConfirmDialog
          open={confirmation !== null}
          onOpenChange={(open) => {
            if (!open) setConfirmation(null)
          }}
          title={FUTURE_MOVE_TITLE}
          description={confirmation ? futureMoveDescription(confirmation) : undefined}
          confirmLabel="체크 해제하고 이동"
          onConfirm={() => {
            if (confirmation) void persist(confirmation, true)
          }}
        />
      </SheetContent>
    </Sheet>
  )
}
