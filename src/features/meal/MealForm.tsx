import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useController, useForm, useWatch } from 'react-hook-form'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ChoiceChips } from '@/components/ChoiceChips'
import { DeleteRecordButton } from '@/components/DeleteRecordButton'
import { ErrorBanner } from '@/components/ErrorBanner'
import { FieldError } from '@/components/form/Field'
import { TextField } from '@/components/form/TextField'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { formatDateLabel, todayString } from '@/domain/date'
import { MealSaveError, type MealEntry } from '@/lib/mealApi'
import { MEAL_INTAKES, mealTypeLabel, type MealType } from '@/lib/mealTypes'
import { NETWORK_ERROR_MESSAGES } from '@/lib/messages'
import { mealCautionFoods, mealCautionMessage } from '@/lib/mealCaution'
import { notifyMealSaved } from '@/lib/mealNotify'
import { useMealRecipes } from '@/lib/useMealRecipes'
import { useFoods } from '@/lib/useFoods'
import { useDeleteMeal, useSaveMeal } from '@/lib/useMeals'
import { MEAL_MESSAGES, mealSchema, type MealFormOutput, type MealFormValues } from './mealSchema'
import { MealCautionNotice } from './MealCautionNotice'
import { MealFoodPicker } from './MealFoodPicker'
import { MealRecipePicker } from './MealRecipePicker'

export function MealForm({
  date,
  type,
  initial,
  birthDate,
  onDone,
  onPendingChange,
}: {
  date: string
  type: MealType
  initial?: MealEntry
  birthDate?: string
  onDone: () => void
  onPendingChange: (pending: boolean) => void
}) {
  const catalog = useFoods()
  const recipeCatalog = useMealRecipes()
  const recipeOptions = recipeCatalog.options
  const [confirmedValues, setConfirmedValues] = useState<MealFormOutput | null>(null)
  const save = useSaveMeal()
  const remove = useDeleteMeal()
  const [failed, setFailed] = useState<'save' | 'delete' | null>(null)
  const [creatingFood, setCreatingFood] = useState(false)
  const {
    control,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<MealFormValues, unknown, MealFormOutput>({
    resolver: zodResolver(mealSchema(birthDate)),
    defaultValues: {
      date,
      foods: initial?.foods ?? [],
      recipes: initial?.recipes ?? [],
      eaten: initial?.eaten ?? date <= todayString(),
      intake: initial?.intake ?? '',
      memo: initial?.memo ?? '',
    },
  })
  const foods = useWatch({ control, name: 'foods' })
  const recipes = useWatch({ control, name: 'recipes' })
  const eaten = useController({ control, name: 'eaten' })
  const intake = useController({ control, name: 'intake' })
  const cautionFoods = mealCautionFoods(foods, recipes, catalog.data ?? [], recipeOptions)
  const warningsReady =
    catalog.isSuccess && !catalog.isFetching && recipeCatalog.isSuccess && !recipeCatalog.isFetching
  const busy = save.isPending || remove.isPending || creatingFood
  const future = date > todayString()
  const onError = (error: unknown, action: 'save' | 'delete') => {
    if (!(error instanceof MealSaveError) || error.reason === 'network') {
      setFailed(action)
      return
    }
    const reason = error.reason
    if (reason === 'beforeBirth') setError('date', { message: MEAL_MESSAGES.beforeBirth })
    else if (reason === 'futureDate') setError('eaten', { message: MEAL_MESSAGES.futureEaten })
    else if (reason === 'memoLength') setError('memo', { message: '500자까지 입력할 수 있어요' })
    else if (reason === 'selection' || reason === 'staleItem')
      setError('foods', { message: MEAL_MESSAGES[reason] })
    else setError('root', { message: MEAL_MESSAGES[reason] })
  }
  const persist = async (values: MealFormOutput) => {
    if (busy || !warningsReady) return
    clearErrors('root')
    setFailed(null)
    onPendingChange(true)
    try {
      const result = await save.mutateAsync({ id: initial?.id, input: { ...values, type } })
      notifyMealSaved(result)
      onDone()
    } catch (error) {
      onError(error, 'save')
    } finally {
      onPendingChange(false)
    }
  }
  const submit = handleSubmit(async (values) => {
    if (busy || !warningsReady) return
    if (cautionFoods.length > 0) setConfirmedValues(values)
    else await persist(values)
  })
  const onDelete = async () => {
    if (!initial) return
    setFailed(null)
    onPendingChange(true)
    try {
      await remove.mutateAsync(initial.id)
      onDone()
    } catch (error) {
      onError(error, 'delete')
    } finally {
      onPendingChange(false)
    }
  }
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <p className="rounded-button bg-soft px-3.5 py-3 text-sm font-bold text-soft-text">
        {formatDateLabel(date)} · {mealTypeLabel(type)}
      </p>
      <MealCautionNotice foods={cautionFoods} />
      {errors.date?.message && <FieldError>{errors.date.message}</FieldError>}
      {errors.root?.message && <FieldError>{errors.root.message}</FieldError>}
      {failed && (
        <ErrorBanner
          message={NETWORK_ERROR_MESSAGES[failed]}
          onRetry={() => (failed === 'save' ? void submit() : void onDelete())}
          retrying={busy}
        />
      )}
      <fieldset disabled={busy} className="contents">
        <MealFoodPicker
          selected={foods}
          disabled={busy}
          error={errors.foods?.message}
          onPendingChange={(pending) => {
            setCreatingFood(pending)
            onPendingChange(pending)
          }}
          onChange={(items) =>
            setValue('foods', items, { shouldValidate: true, shouldDirty: true })
          }
        />
        <MealRecipePicker
          options={recipeOptions}
          loading={recipeCatalog.isPending}
          failed={recipeCatalog.isError}
          retrying={recipeCatalog.isFetching}
          onRetry={() => void recipeCatalog.refetch()}
          selected={recipes}
          disabled={busy}
          onChange={(items) => {
            setValue('recipes', items, { shouldDirty: true })
            clearErrors('foods')
          }}
        />
        <div className="flex flex-col gap-2">
          <label className="flex min-h-12 items-center gap-3 rounded-button border px-3 text-sm font-bold">
            <Checkbox
              checked={eaten.field.value}
              onCheckedChange={(checked) => eaten.field.onChange(checked === true)}
              disabled={future || busy}
              aria-invalid={!!errors.eaten}
              aria-describedby={
                errors.eaten ? 'meal-eaten-error' : future ? 'meal-future-help' : undefined
              }
            />
            먹음
          </label>
          {future && (
            <p id="meal-future-help" className="text-[13px] text-muted-foreground">
              내일 이후의 식단은 계획으로 저장돼요
            </p>
          )}
          {errors.eaten?.message && (
            <FieldError id="meal-eaten-error">{errors.eaten.message}</FieldError>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-bold">
            먹은 정도 <span className="font-normal text-muted-foreground">(선택)</span>
          </span>
          <ChoiceChips
            label="먹은 정도"
            options={[{ value: '', label: '선택 안 함' }, ...MEAL_INTAKES]}
            value={intake.field.value}
            onChange={intake.field.onChange}
          />
        </div>
        <TextField
          control={control}
          name="memo"
          label="메모"
          maxLength={500}
          multiline
          placeholder="예: 반 공기 먹었어요"
          id="meal-memo"
        />
        <div className="grid grid-cols-2 gap-2.5">
          <Button type="button" size="lg" variant="soft" onClick={onDone}>
            취소
          </Button>
          <Button type="submit" size="lg" disabled={!warningsReady}>
            {save.isPending ? '저장하는 중…' : '저장'}
          </Button>
        </div>
        {initial && (
          <DeleteRecordButton
            onConfirm={() => void onDelete()}
            pending={busy}
            title="이 식단을 삭제할까요?"
            description="삭제하면 음식 상태와 처음 먹은 날도 다시 계산돼요"
          />
        )}
      </fieldset>
      <ConfirmDialog
        open={confirmedValues !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmedValues(null)
        }}
        title={mealCautionMessage(cautionFoods)}
        description="음식을 확인한 후 저장해 주세요. 계획으로 저장할 때도 주의가 필요해요."
        confirmLabel="그래도 저장"
        onConfirm={() => {
          if (confirmedValues) void persist(confirmedValues)
        }}
      />
    </form>
  )
}
