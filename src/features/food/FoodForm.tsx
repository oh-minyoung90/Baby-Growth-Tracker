import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useController, useForm, type Control } from 'react-hook-form'
import { DeleteRecordButton } from '@/components/DeleteRecordButton'
import { ErrorBanner } from '@/components/ErrorBanner'
import { DateInput } from '@/components/form/DateField'
import { Field, FieldError } from '@/components/form/Field'
import { invalidProps } from '@/components/form/invalidProps'
import { TextField } from '@/components/form/TextField'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { todayString } from '@/domain/date'
import { isSameContent } from '@/domain/text'
import { FoodSaveError, type Food, type FoodInput } from '@/lib/foodApi'
import { FOOD_GROUPS } from '@/lib/foodTypes'
import { NETWORK_ERROR_MESSAGES } from '@/lib/messages'
import { notifySaved } from '@/lib/notify'
import { useDeleteFood, useSaveFood } from '@/lib/useFoods'
import {
  FOOD_MESSAGES,
  MEMO_MAX,
  NAME_MAX,
  foodSchema,
  serverFieldError,
  type FoodFormValues,
} from './foodSchema'

type FormControl = Control<FoodFormValues, unknown, FoodInput>

/** 음식 추가·수정 폼 (FR-FOOD-04~05, 08, R45). 바텀 시트 안에 놓인다 */
export function FoodForm({
  initial,
  birthDate,
  foods,
  onDone,
}: {
  /** 수정할 음식. 없으면 새 음식 */
  initial?: Food
  birthDate: string
  /** 같은 이름의 음식이 있는지 확인할 때 쓴다 (BR-18) */
  foods: readonly Food[]
  /** 저장·삭제·취소 후 시트를 닫는다 */
  onDone: () => void
}) {
  const save = useSaveFood()
  const remove = useDeleteFood()
  const [failed, setFailed] = useState<'save' | 'delete' | null>(null)

  const { control, handleSubmit, setError } = useForm<FoodFormValues, unknown, FoodInput>({
    resolver: zodResolver(foodSchema(birthDate)),
    defaultValues: {
      name: initial?.name ?? '',
      group: initial?.group ?? '',
      memo: initial?.memo ?? '',
      // 알러지·주의 음식의 상태는 지정·해제로만 바뀌므로 묻지 않는다 (FR-FOOD-06, T-38)
      alreadyTried: initial?.status === 'caution' ? null : (initial?.manualTried ?? false),
      firstTriedDate: initial?.manualFirstTriedDate ?? '',
    },
  })

  const onSubmit = handleSubmit(async (input) => {
    setFailed(null)
    // 같은 이름의 음식은 하나만 둔다 (BR-18). 서버도 같은 기준으로 거부한다
    if (foods.some((food) => food.id !== initial?.id && isSameContent(food.name, input.name))) {
      setError('name', { message: FOOD_MESSAGES.duplicate }, { shouldFocus: true })
      return
    }
    try {
      await save.mutateAsync({ id: initial?.id, input })
      notifySaved()
      onDone()
    } catch (error) {
      // 서버(DB) 검증에 걸리면 화면 검증과 같은 자리에 같은 문구로 알린다 (FR-COM-13)
      const fieldError = serverFieldError(error instanceof FoodSaveError ? error.reason : 'network')
      if (fieldError) setError(fieldError.field, { message: fieldError.message })
      else setFailed('save')
    }
  })

  const onDelete = async () => {
    if (!initial) return
    setFailed(null)
    try {
      await remove.mutateAsync(initial.id)
      onDone()
    } catch {
      setFailed('delete')
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {/* 네트워크 오류: 입력값은 그대로 두고 다시 시도할 수 있게 한다 (기능요구사항서 3.4) */}
      {failed === 'save' && (
        <ErrorBanner onRetry={() => void onSubmit()} retrying={save.isPending} />
      )}
      {failed === 'delete' && (
        <ErrorBanner
          message={NETWORK_ERROR_MESSAGES.delete}
          onRetry={() => void onDelete()}
          retrying={remove.isPending}
        />
      )}

      <TextField
        control={control}
        name="name"
        id="food-name"
        label="이름"
        placeholder="예: 브로콜리"
        maxLength={NAME_MAX}
      />
      <GroupField control={control} />
      <TextField
        control={control}
        name="memo"
        id="food-memo"
        label="메모"
        placeholder="예: 찐 다음 잘게 다져서"
        maxLength={MEMO_MAX}
        multiline
      />
      <TriedField control={control} birthDate={birthDate} />

      <div className="mt-1 grid grid-cols-2 gap-2.5">
        <Button type="button" variant="soft" size="lg" onClick={onDone}>
          취소
        </Button>
        <Button type="submit" size="lg" disabled={save.isPending}>
          {save.isPending ? '저장하는 중…' : '저장'}
        </Button>
      </div>
      {initial && (
        <DeleteRecordButton
          onConfirm={() => void onDelete()}
          pending={remove.isPending}
          title="이 음식을 삭제할까요?"
          description="식단과 레시피에 적힌 이름은 그대로 남아요"
        />
      )}
    </form>
  )
}

/** 식품군 고르기 (FR-FOOD-04). 선택 상태는 보라색 (docs/디자인.md 2.4) */
function GroupField({ control }: { control: FormControl }) {
  const {
    field: { ref, value, onChange },
    fieldState,
  } = useController({ control, name: 'group' })
  const error = fieldState.error?.message

  return (
    <div className="flex flex-col gap-2">
      <span id="food-group-label" className="text-sm font-bold">
        식품군
      </span>
      <div
        role="radiogroup"
        aria-labelledby="food-group-label"
        aria-describedby={error ? 'food-group-error' : undefined}
        className="grid grid-cols-3 gap-2"
      >
        {FOOD_GROUPS.map((group, index) => (
          <button
            key={group.value}
            // 저장할 때 식품군이 비어 있으면 첫 버튼으로 초점을 옮긴다
            ref={index === 0 ? ref : undefined}
            type="button"
            role="radio"
            aria-checked={value === group.value}
            onClick={() => onChange(group.value)}
            className="h-12 rounded-xl border border-line bg-surface text-[15px] font-bold text-muted-foreground transition-colors aria-checked:border-2 aria-checked:border-primary aria-checked:bg-soft aria-checked:text-soft-text"
          >
            {group.label}
          </button>
        ))}
      </div>
      {error && <FieldError id="food-group-error">{error}</FieldError>}
    </div>
  )
}

/**
 * "이미 먹어 봤어요" + 처음 먹은 날(선택) (FR-FOOD-05, BR-17, R45).
 * 기본 음식처럼 아직 안 먹어봄으로 들어간 음식도 수정할 때 고를 수 있다. 알러지·주의 음식은 묻지 않는다
 */
function TriedField({ control, birthDate }: { control: FormControl; birthDate: string }) {
  const {
    field: { value: tried, onChange: setTried },
  } = useController({ control, name: 'alreadyTried' })
  const {
    field: { value: date, onChange: setDate, ...dateField },
    fieldState,
  } = useController({ control, name: 'firstTriedDate' })
  const error = fieldState.error?.message

  if (tried === null) return null
  const checked = tried === true

  return (
    <div className="flex flex-col gap-3 rounded-input border border-line p-3.5">
      <div className="flex items-start gap-3">
        <Checkbox
          id="food-tried"
          checked={checked}
          onCheckedChange={(next) => {
            setTried(next === true)
            // 체크를 끄면 날짜를 비운다 (먹어 보지 않은 음식에는 처음 먹은 날이 없다)
            if (next !== true) setDate('')
          }}
          className="mt-0.5"
          aria-describedby="food-tried-help"
        />
        <div className="flex flex-col gap-0.5">
          <Label htmlFor="food-tried" className="text-[15px]">
            이미 먹어 봤어요
          </Label>
          <p id="food-tried-help" className="text-[13px] text-muted-foreground">
            앱을 쓰기 전에 먹어 본 음식이면 골라 주세요
          </p>
        </div>
      </div>
      {checked && (
        <Field
          id="food-first-tried"
          label="처음 먹은 날 (선택)"
          error={error}
          aside={
            date ? (
              <button
                type="button"
                onClick={() => setDate('')}
                className="relative text-sm font-bold text-soft-text after:absolute after:-inset-3"
              >
                날짜 지우기
              </button>
            ) : undefined
          }
        >
          <DateInput
            {...dateField}
            id="food-first-tried"
            value={typeof date === 'string' ? date : ''}
            onChange={(event) => setDate(event.target.value)}
            min={birthDate}
            max={todayString()}
            {...invalidProps('food-first-tried', error)}
          />
        </Field>
      )}
    </div>
  )
}
