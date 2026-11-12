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
import { format, addDays } from 'date-fns'
import { formatDateLabel, todayString, parseDate } from '@/domain/date'
import { MealSaveError, type MealEntry, type MealMoveTarget } from '@/lib/mealApi'
import { MEAL_TYPES, mealTypeLabel } from '@/lib/mealTypes'
import { recordDate } from '@/lib/validation'
import { mealCautionMessage } from '@/lib/mealCaution'
import { MealCautionNotice } from './MealCautionNotice'
import { FUTURE_MOVE_TITLE, futureMoveDescription, mealMoveError, mealCopyError } from './mealMove'

export function MealMoveSheet({
  entry,
  birthDate,
  pending,
  onMove,
  onClose,
  mode = 'move',
  cautionFoods = [],
  warningsReady = true,
  cautionFailed = false,
  onRetryCaution,
}: {
  entry: MealEntry
  birthDate?: string
  pending: boolean
  onMove: (entry: MealEntry, target: MealMoveTarget, uncheck: boolean) => Promise<void>
  onClose: () => void
  mode?: 'move' | 'copy'
  cautionFoods?: readonly { name: string }[]
  warningsReady?: boolean
  cautionFailed?: boolean
  onRetryCaution?: () => void
}) {
  const [confirmation, setConfirmation] = useState<MealMoveTarget | null>(null)
  const [failure, setFailure] = useState<unknown>(null)
  const schema = z.object({
    date: recordDate({ birthDate, allowFuture: true }),
    type: z.enum(MEAL_TYPES.map((item) => item.value)),
  })
  const { control, handleSubmit } = useForm<MealMoveTarget>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: mode === 'copy' ? format(addDays(parseDate(entry.date), 1), 'yyyy-MM-dd') : entry.date,
      type: entry.type,
    },
  })
  const type = useController({ control, name: 'type' })
  const persist = async (target: MealMoveTarget, uncheck: boolean) => {
    if (pending || (mode === 'copy' && !warningsReady)) return
    setFailure(null)
    try {
      await onMove(entry, target, uncheck)
    } catch (error) {
      setFailure(error)
    }
  }
  const submit = handleSubmit(async (target) => {
    if (pending || (mode === 'copy' && !warningsReady)) return
    setFailure(null)
    if (mode === 'copy' && cautionFoods.length > 0) setConfirmation(target)
    else if (mode === 'move' && entry.eaten && target.date > todayString()) setConfirmation(target)
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
        <SheetTitle>{mode === 'copy' ? '식단 복사' : '식단 이동'}</SheetTitle>
        <p className="text-sm text-muted-foreground">
          {formatDateLabel(entry.date)} · {mealTypeLabel(entry.type)}
          <br />
          {[...entry.foods, ...entry.recipes].map((item) => item.name).join(', ')}
        </p>
        {mode === 'copy' && (
          <>
            <p className="rounded-button bg-soft p-3 text-sm text-soft-text">
              음식·레시피·메모를 새 계획으로 복사해요. 원래 식단은 그대로 두고 먹음 체크와 먹은
              정도는 비워요.
            </p>
            <MealCautionNotice foods={cautionFoods} />
            {!warningsReady &&
              (cautionFailed ? (
                <ErrorBanner
                  message="주의 음식 정보를 불러오지 못했어요"
                  onRetry={onRetryCaution}
                />
              ) : (
                <p role="status" className="text-sm text-muted-foreground">
                  주의 음식 정보를 확인하고 있어요
                </p>
              ))}
          </>
        )}
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          {failure !== null &&
            (failure instanceof MealSaveError && failure.reason !== 'network' ? (
              <FieldError>
                {mode === 'copy' ? mealCopyError(failure) : mealMoveError(failure)}
              </FieldError>
            ) : (
              <ErrorBanner
                message={mode === 'copy' ? mealCopyError(failure) : mealMoveError(failure)}
                onRetry={() => void submit()}
                retrying={pending}
              />
            ))}
          <fieldset disabled={pending} className="contents">
            <DateField
              control={control}
              name="date"
              label={mode === 'copy' ? '복사할 날짜' : '옮길 날짜'}
              min={birthDate}
              id="meal-move-date"
            />
            <div className="flex flex-col gap-2">
              <span className="text-sm font-bold">
                {mode === 'copy' ? '복사할 끼니' : '옮길 끼니'}
              </span>
              <ChoiceChips
                label={mode === 'copy' ? '복사할 끼니' : '옮길 끼니'}
                options={MEAL_TYPES.map((item) => ({ ...item }))}
                value={type.field.value}
                onChange={type.field.onChange}
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Button type="button" variant="soft" onClick={onClose}>
                취소
              </Button>
              <Button type="submit" disabled={mode === 'copy' && !warningsReady}>
                {mode === 'copy'
                  ? pending
                    ? '복사하는 중…'
                    : '복사'
                  : pending
                    ? '옮기는 중…'
                    : '이동'}
              </Button>
            </div>
          </fieldset>
        </form>
        <ConfirmDialog
          open={confirmation !== null}
          onOpenChange={(open) => {
            if (!open) setConfirmation(null)
          }}
          title={mode === 'copy' ? mealCautionMessage(cautionFoods) : FUTURE_MOVE_TITLE}
          description={
            mode === 'copy'
              ? '음식을 확인한 후 새 계획으로 복사해 주세요.'
              : confirmation
                ? futureMoveDescription(confirmation)
                : undefined
          }
          confirmLabel={mode === 'copy' ? '그래도 복사' : '체크 해제하고 이동'}
          onConfirm={() => {
            if (confirmation) void persist(confirmation, mode === 'move')
          }}
        />
      </SheetContent>
    </Sheet>
  )
}
