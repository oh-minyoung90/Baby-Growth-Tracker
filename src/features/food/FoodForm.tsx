import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Info } from 'lucide-react'
import { useController, useForm, useWatch, type Control } from 'react-hook-form'
import { DeleteRecordButton } from '@/components/DeleteRecordButton'
import { ErrorBanner } from '@/components/ErrorBanner'
import { DateInput } from '@/components/form/DateField'
import { Field, FieldError } from '@/components/form/Field'
import { invalidProps } from '@/components/form/invalidProps'
import { TextField } from '@/components/form/TextField'
import { Button } from '@/components/ui/button'
import { todayString } from '@/domain/date'
import { withTopicParticle } from '@/domain/josa'
import { FoodSaveError, type Food, type FoodInput } from '@/lib/foodApi'
import { FOOD_GROUPS, FOOD_PREFERENCES } from '@/lib/foodTypes'
import { NETWORK_ERROR_MESSAGES } from '@/lib/messages'
import { notifySaved } from '@/lib/notify'
import { useDeleteFood, useSaveFood } from '@/lib/useFoods'
import { findSameName } from './foodFilter'
import {
  FOOD_MESSAGES,
  MEMO_MAX,
  NAME_MAX,
  foodSchema,
  serverFieldError,
  type FoodFormValues,
} from './foodSchema'

type FormControl = Control<FoodFormValues, unknown, FoodInput>

/**
 * 음식 추가·수정 폼 (FR-FOOD-04~05, 08, 10, R45~47). 바텀 시트 안에 놓인다.
 * 상태는 고르지 않는다. 추가는 보고 있던 탭(먹어봄 / 안 먹어봄)이, 수정은 그 음식의 상태가 화면 모양을 정한다.
 * 먹어봄이면 처음 먹은 날·반응을 함께 입력한다
 */
export function FoodForm({
  initial,
  addTried = false,
  birthDate,
  foods,
  onDone,
  onEditExisting,
}: {
  /** 수정할 음식. 없으면 새 음식 */
  initial?: Food
  /** 새 음식을 먹어봄으로 추가하는지 (먹어봄 탭에서 열었을 때) */
  addTried?: boolean
  birthDate: string
  /** 같은 이름의 음식이 있는지 확인할 때 쓴다 (BR-18) */
  foods: readonly Food[]
  /** 저장·삭제·취소 후 시트를 닫는다 */
  onDone: () => void
  /** 같은 이름의 기존 음식을 수정 시트로 연다 */
  onEditExisting: (id: string) => void
}) {
  const save = useSaveFood()
  const remove = useDeleteFood()
  const [failed, setFailed] = useState<'save' | 'delete' | null>(null)
  // 수정 전 상태. 알러지·주의 음식은 지정·해제로만 상태가 바뀌므로 묻지 않는다 (FR-FOOD-06, T-38)
  // T-40 이후 식단 "먹음" 기록으로 먹어봄이 된 음식을 옮길 때의 동작은 그때 다시 정한다
  const initialTried = initial
    ? initial.status === 'caution'
      ? null
      : initial.status === 'tried'
    : addTried

  const { control, handleSubmit, setError, setFocus, setValue, getValues } = useForm<
    FoodFormValues,
    unknown,
    FoodInput
  >({
    resolver: zodResolver(foodSchema(birthDate)),
    defaultValues: {
      name: initial?.name ?? '',
      group: initial?.group ?? '',
      memo: initial?.memo ?? '',
      alreadyTried: initialTried,
      firstTriedDate: initial?.manualFirstTriedDate ?? '',
      preference: initial?.preference ?? null,
    },
  })
  const tried = useWatch({ control, name: 'alreadyTried' })

  // 같은 이름의 음식은 하나만 둔다 (BR-18). 입력하는 동안 바로 알려 준다 (R47)
  const name = useWatch({ control, name: 'name' })
  const sameName = findSameName(foods, name, initial?.id)
  // 먹어 본 음식을 추가하는데 안 먹어봄에 같은 이름이 있으면, 새로 만들지 않고 그 음식을 먹어봄으로 옮긴다
  const moveTarget = !initial && addTried && sameName?.status === 'not_tried' ? sameName : undefined

  // 옮길 음식의 식품군을 채운다 (비어 있을 때만)
  useEffect(() => {
    if (moveTarget && getValues('group') === '') {
      setValue('group', moveTarget.group, { shouldValidate: true })
    }
  }, [moveTarget, getValues, setValue])

  const submit = async (id: string | undefined, input: FoodInput) => {
    try {
      await save.mutateAsync({ id, input })
      notifySaved()
      onDone()
    } catch (error) {
      // 서버(DB) 검증에 걸리면 화면 검증과 같은 자리에 같은 문구로 알린다 (FR-COM-13)
      const fieldError = serverFieldError(error instanceof FoodSaveError ? error.reason : 'network')
      if (fieldError) setError(fieldError.field, { message: fieldError.message })
      else setFailed('save')
    }
  }

  const onSubmit = handleSubmit(async (input) => {
    setFailed(null)
    const same = findSameName(foods, input.name, initial?.id)
    if (same && same === moveTarget) {
      // 이름은 기존 음식 그대로 두고, 메모를 비워 두었으면 기존 메모를 남긴다
      await submit(same.id, { ...input, name: same.name, memo: input.memo ?? same.memo })
      return
    }
    if (same) {
      // 아래 안내가 이미 보이므로 이름 칸으로 돌아가기만 한다. 서버도 같은 기준으로 거부한다
      setFocus('name')
      return
    }
    await submit(initial?.id, input)
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

  // 수정할 때 다른 상태로 옮기는 중인지 (저장해야 옮겨진다)
  const moving = initial !== undefined && initialTried !== null && tried !== initialTried

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
      {moving && (
        <Notice
          title={tried ? '먹어봄으로 옮겨요' : '아직 안 먹어봄으로 옮겨요'}
          detail={
            tried
              ? '처음 먹은 날과 반응을 넣고 저장해 주세요'
              : '저장하면 처음 먹은 날과 반응은 지워져요'
          }
        />
      )}

      <div className="flex flex-col gap-2">
        <TextField
          control={control}
          name="name"
          id="food-name"
          label="이름"
          placeholder="예: 브로콜리"
          maxLength={NAME_MAX}
        />
        {sameName && (
          <SameNameNotice
            food={sameName}
            moves={sameName === moveTarget}
            onOpen={() => onEditExisting(sameName.id)}
          />
        )}
      </div>
      <GroupField control={control} />
      {tried === true && (
        <>
          <FirstTriedDateField control={control} birthDate={birthDate} />
          <PreferenceField control={control} />
        </>
      )}
      <TextField
        control={control}
        name="memo"
        id="food-memo"
        label="메모"
        placeholder="예: 찐 다음 잘게 다져서"
        maxLength={MEMO_MAX}
        multiline
      />

      <div className="mt-1 grid grid-cols-2 gap-2.5">
        <Button type="button" variant="soft" size="lg" onClick={onDone}>
          취소
        </Button>
        <Button type="submit" size="lg" disabled={save.isPending}>
          {save.isPending ? '저장하는 중…' : '저장'}
        </Button>
      </div>
      {initial && initialTried !== null && (
        // 잘못 넣었을 때 다른 상태로 옮긴다 (R45, R47). 누르면 화면만 바뀌고 저장해야 옮겨진다
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const next = !tried
            setValue('alreadyTried', next)
            // 먹어 보지 않은 음식에는 처음 먹은 날이 없다 (반응은 저장할 때 지운다)
            if (!next) setValue('firstTriedDate', '')
          }}
        >
          {moving
            ? initialTried
              ? '먹어봄에 두기'
              : '아직 안 먹어봄에 두기'
            : initialTried
              ? '아직 안 먹어봄으로 옮기기'
              : '먹어봄으로 옮기기'}
        </Button>
      )}
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

/** 연보라 안내 상자: 아이콘 + 제목 + 설명 (+ 버튼) */
function Notice({
  title,
  detail,
  action,
}: {
  title: string
  detail: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-input bg-soft px-3.5 py-3 text-soft-text"
    >
      <Info className="size-5 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 text-sm">
        <strong className="block">{title}</strong>
        {detail}
      </p>
      {action && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}

/**
 * 같은 이름의 음식이 이미 있을 때 (BR-18, R47).
 * 먹어 본 음식을 추가하는데 안 먹어봄에 있으면 저장할 때 그 음식을 옮긴다고 알리고,
 * 그 밖에는 어느 목록에 있는지 알리고 그 음식을 열 수 있게 한다
 */
function SameNameNotice({
  food,
  moves,
  onOpen,
}: {
  food: Food
  moves: boolean
  onOpen: () => void
}) {
  const name = withTopicParticle(food.name)
  if (moves) {
    return (
      <Notice
        title="아직 안 먹어 본 음식으로 있어요"
        detail={`${name} '아직 안 먹어봄'에 있어요. 저장하면 먹어봄으로 옮겨요`}
      />
    )
  }
  const action = { label: '이 음식 열기', onClick: onOpen }
  switch (food.status) {
    case 'tried':
      return (
        <Notice
          title="이미 먹어 본 음식이에요"
          detail={`${name} '먹어봄'에 있어요`}
          action={action}
        />
      )
    case 'not_tried':
      return (
        <Notice
          title={FOOD_MESSAGES.duplicate}
          detail={`${name} '아직 안 먹어봄'에 있어요`}
          action={action}
        />
      )
    case 'caution':
      return (
        <Notice
          title={FOOD_MESSAGES.duplicate}
          detail={`${name} '알러지·주의'에 있어요`}
          action={action}
        />
      )
  }
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

/** 처음 먹은 날 (선택, BR-17). 먹어봄일 때만 보인다 */
function FirstTriedDateField({ control, birthDate }: { control: FormControl; birthDate: string }) {
  const {
    field: { value, onChange, ...field },
    fieldState,
  } = useController({ control, name: 'firstTriedDate' })
  const error = fieldState.error?.message

  return (
    <Field
      id="food-first-tried"
      label="처음 먹은 날 (선택)"
      error={error}
      aside={
        value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="relative text-sm font-bold text-soft-text after:absolute after:-inset-3"
          >
            날짜 지우기
          </button>
        ) : undefined
      }
    >
      <DateInput
        {...field}
        id="food-first-tried"
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => onChange(event.target.value)}
        min={birthDate}
        max={todayString()}
        {...invalidProps('food-first-tried', error)}
      />
    </Field>
  )
}

/** 아이 반응 (선택): 매우 좋아함·좋아함·보통·거부. 고른 것을 다시 누르면 선택을 푼다 (시안 D-07 음식 상세와 같음) */
function PreferenceField({ control }: { control: FormControl }) {
  const {
    field: { value, onChange },
  } = useController({ control, name: 'preference' })

  return (
    <div className="flex flex-col gap-2">
      <span id="food-preference-label" className="text-sm font-bold">
        아이 반응 (선택)
      </span>
      <div
        role="radiogroup"
        aria-labelledby="food-preference-label"
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {FOOD_PREFERENCES.map((preference) => (
          <button
            key={preference.value}
            type="button"
            role="radio"
            aria-checked={value === preference.value}
            onClick={() => onChange(value === preference.value ? null : preference.value)}
            className="h-11 rounded-xl border border-line bg-surface text-sm font-bold text-muted-foreground transition-colors aria-checked:border-2 aria-checked:border-primary aria-checked:bg-soft aria-checked:text-soft-text"
          >
            {preference.label}
          </button>
        ))}
      </div>
    </div>
  )
}
