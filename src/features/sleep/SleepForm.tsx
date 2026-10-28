import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Moon, Plus, Sun, X } from 'lucide-react'
import {
  useController,
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type ControllerRenderProps,
} from 'react-hook-form'
import { DeleteRecordButton } from '@/components/DeleteRecordButton'
import { ErrorBanner } from '@/components/ErrorBanner'
import { DateInput } from '@/components/form/DateField'
import { Field, FieldError } from '@/components/form/Field'
import { invalidProps } from '@/components/form/invalidProps'
import { TextField } from '@/components/form/TextField'
import { FormActions } from '@/components/FormPage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDateTimeLabel, todayString } from '@/domain/date'
import { formatDuration } from '@/domain/sleep'
import { NETWORK_ERROR_MESSAGES } from '@/lib/messages'
import { notifySaved } from '@/lib/notify'
import { SleepSaveError, type SleepLog, type SleepLogInput } from '@/lib/sleepApi'
import { useDeleteSleepLog, useSaveSleepLog } from '@/lib/useSleepLogs'
import {
  MEMO_MAX,
  calculateSleepValues,
  emptySleepValues,
  serverFieldError,
  sleepSchema,
  toSleepFormValues,
  type SleepFormValues,
} from './sleepSchema'

type FormControl = Control<SleepFormValues, unknown, SleepLogInput>

/**
 * 수면 입력·수정 폼 (SCR-08, FR-SLEEP-01~07, FR-COM-30~31).
 * 수면일은 화면(SleepFormPage)이 함께 들고 있다가, 그 수면일의 기록이 바뀌면 이 폼을 새로 그린다 (FR-SLEEP-08)
 */
export function SleepForm({
  initial,
  date,
  onDateChange,
  dateHint,
  birthDate,
  onDone,
}: {
  /** 수정할 기록. 없으면 새 기록 */
  initial?: SleepLog
  /** 수면일 'YYYY-MM-DD' */
  date: string
  onDateChange: (date: string) => void
  /** 수면일 칸 아래 안내 */
  dateHint: string
  birthDate: string
  /** 저장·삭제·취소 후 진입했던 화면으로 돌아간다 */
  onDone: () => void
}) {
  const save = useSaveSleepLog()
  const remove = useDeleteSleepLog()
  const [failed, setFailed] = useState<'save' | 'delete' | null>(null)

  const {
    control,
    handleSubmit,
    setError,
    formState: { isSubmitting },
  } = useForm<SleepFormValues, unknown, SleepLogInput>({
    resolver: zodResolver(sleepSchema(birthDate)),
    defaultValues: initial ? toSleepFormValues(initial, date) : emptySleepValues(date),
  })
  const naps = useFieldArray({ control, name: 'naps' })
  const [watchedDate, bedTime, wakeTime, watchedNaps] = useWatch({
    control,
    name: ['date', 'bedTime', 'wakeTime', 'naps'],
  })
  // 입력하는 동안 붙은 날짜와 총 수면을 바로 계산한다 (FR-SLEEP-03, 05)
  const result = calculateSleepValues({
    date: watchedDate,
    bedTime,
    wakeTime,
    naps: watchedNaps,
  })

  const onSubmit = handleSubmit(async (input) => {
    setFailed(null)
    try {
      await save.mutateAsync({ id: initial?.id, input })
      notifySaved()
      onDone()
    } catch (error) {
      // 서버(DB) 검증에 걸리면 화면 검증과 같은 자리에 같은 문구로 알린다 (FR-COM-13)
      const fieldError = serverFieldError(
        error instanceof SleepSaveError ? error.reason : 'network',
      )
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
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
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

      <SleepDateField
        control={control}
        birthDate={birthDate}
        hint={dateHint}
        onDateChange={onDateChange}
      />

      <section
        aria-labelledby="sl-night-title"
        className="flex flex-col gap-3 rounded-card border bg-surface p-4"
      >
        <h2 id="sl-night-title" className="flex items-center gap-2 text-base font-bold">
          <Moon className="size-4.5 text-soft-text" aria-hidden />
          밤잠
        </h2>
        <NightFields control={control} bedAt={result?.bedAt} wakeAt={result?.wakeAt} />
      </section>

      <section
        aria-labelledby="sl-naps-title"
        className="flex flex-col gap-3 rounded-card border bg-surface p-4"
      >
        <h2 id="sl-naps-title" className="flex items-center gap-2 text-base font-bold">
          <Sun className="size-4.5 text-soft-text" aria-hidden />
          낮잠
          <span className="text-[13px] font-normal text-muted-foreground">(수면일 당일)</span>
        </h2>
        {naps.fields.map((nap, index) => (
          <NapRow
            key={nap.id}
            control={control}
            index={index}
            onRemove={() => naps.remove(index)}
          />
        ))}
        {/* 낮잠은 여러 번 입력할 수 있다 (FR-SLEEP-04) */}
        <button
          type="button"
          onClick={() => naps.append({ start: '', end: '' })}
          className="flex h-12 items-center justify-center gap-1.5 rounded-input border border-dashed border-soft-text text-[15px] font-bold text-soft-text transition-colors hover:bg-soft"
        >
          <Plus className="size-4.5" aria-hidden />
          낮잠 추가
        </button>
      </section>

      <SleepSummary
        nightMinutes={result?.nightMinutes ?? null}
        hasNightInput={Boolean(bedTime || wakeTime)}
        napMinutes={result?.napMinutes ?? 0}
        napCount={result?.naps.length ?? 0}
        totalMinutes={result?.totalMinutes ?? 0}
      />

      <TextField
        control={control}
        name="memo"
        id="sl-memo"
        label="메모"
        placeholder="자다 깬 일, 컨디션 등"
        maxLength={MEMO_MAX}
        multiline
      />

      <FormActions>
        <Button type="button" variant="soft" size="lg" onClick={onDone}>
          취소
        </Button>
        <Button type="submit" size="lg" disabled={isSubmitting || save.isPending}>
          {save.isPending ? '저장하는 중…' : '저장'}
        </Button>
      </FormActions>
      {initial && (
        <DeleteRecordButton onConfirm={() => void onDelete()} pending={remove.isPending} />
      )}
    </form>
  )
}

/** 수면일 (FR-SLEEP-01). 바꾸면 화면에 알려 그 수면일의 기록을 찾게 한다 (FR-SLEEP-08) */
function SleepDateField({
  control,
  birthDate,
  hint,
  onDateChange,
}: {
  control: FormControl
  birthDate: string
  hint: string
  onDateChange: (date: string) => void
}) {
  const {
    field: { value, onChange, ...field },
    fieldState,
  } = useController({ control, name: 'date' })
  const error = fieldState.error?.message

  return (
    <div className="flex flex-col gap-1.5">
      <Field id="sl-date" label="수면일" error={error}>
        <DateInput
          {...field}
          id="sl-date"
          value={value}
          min={birthDate}
          max={todayString()}
          onChange={(event) => {
            onChange(event)
            onDateChange(event.target.value)
          }}
          {...invalidProps('sl-date', error)}
        />
      </Field>
      <p aria-live="polite" className="text-[13px] text-muted-foreground">
        {hint}
      </p>
    </div>
  )
}

/** 잠든 시간·일어난 시간과 붙은 날짜 (FR-SLEEP-02~03). 밤잠 오류는 두 칸 아래에 한 번 보여 준다 */
function NightFields({
  control,
  bedAt,
  wakeAt,
}: {
  control: FormControl
  bedAt: string | null | undefined
  wakeAt: string | null | undefined
}) {
  const bed = useController({ control, name: 'bedTime' })
  const wake = useController({ control, name: 'wakeTime' })
  const error = bed.fieldState.error?.message ?? wake.fieldState.error?.message

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        <TimeField
          id="sl-bed"
          label="잠든 시간"
          field={bed.field}
          invalid={bed.fieldState.invalid}
          errorId="sl-night-error"
          attachedAt={bedAt}
        />
        <TimeField
          id="sl-wake"
          label="일어난 시간"
          field={wake.field}
          invalid={wake.fieldState.invalid}
          errorId="sl-night-error"
          attachedAt={wakeAt}
        />
      </div>
      {error && <FieldError id="sl-night-error">{error}</FieldError>}
    </>
  )
}

/** 시각 입력칸 + 붙은 날짜 "→ 10. 19. (월) 21:30" (FR-SLEEP-03) */
function TimeField({
  id,
  label,
  field: { value, ...field },
  invalid,
  errorId,
  attachedAt,
}: {
  id: string
  label: string
  field: ControllerRenderProps<SleepFormValues, 'bedTime' | 'wakeTime'>
  invalid: boolean
  errorId: string
  attachedAt: string | null | undefined
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        {...field}
        id={id}
        type="time"
        value={value}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
      />
      {attachedAt && (
        <span className="text-xs text-soft-text">→ {formatDateTimeLabel(attachedAt)}</span>
      )}
    </div>
  )
}

/**
 * 낮잠 한 줄: 이름과 삭제, 시작 ~ 끝 (FR-SLEEP-04). 오류는 줄 아래에.
 * 모바일 폭에서도 "오전 10:00"이 잘리지 않게 시각 칸을 한 줄에 둘만 둔다
 */
function NapRow({
  control,
  index,
  onRemove,
}: {
  control: FormControl
  index: number
  onRemove: () => void
}) {
  const start = useController({ control, name: `naps.${index}.start` })
  const end = useController({ control, name: `naps.${index}.end` })
  const error = start.fieldState.error?.message ?? end.fieldState.error?.message
  const id = `sl-nap-${index}`
  const label = `낮잠 ${index + 1}`

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-bold">{label}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`${label} 삭제`}
          onClick={onRemove}
          className="-my-2 -mr-2 text-muted-foreground"
        >
          <X className="size-5" aria-hidden />
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Input
          {...start.field}
          type="time"
          aria-label={`${label} 시작`}
          className="flex-1"
          {...invalidProps(id, start.fieldState.error?.message)}
        />
        <span aria-hidden className="text-muted-foreground">
          ~
        </span>
        <Input
          {...end.field}
          type="time"
          aria-label={`${label} 끝`}
          className="flex-1"
          {...invalidProps(id, end.fieldState.error?.message)}
        />
      </div>
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  )
}

/** 총 수면 = 밤잠 + 낮잠, 입력하는 동안 바로 계산 (FR-SLEEP-05~06, BR-07) */
function SleepSummary({
  nightMinutes,
  hasNightInput,
  napMinutes,
  napCount,
  totalMinutes,
}: {
  nightMinutes: number | null
  hasNightInput: boolean
  napMinutes: number
  napCount: number
  totalMinutes: number
}) {
  // 잠든·일어난 시간 중 하나만 있으면 밤잠은 계산하지 않는다 (FR-SLEEP-06)
  const night =
    nightMinutes !== null ? formatDuration(nightMinutes) : hasNightInput ? '계산 불가' : '없음'
  const nap = napCount > 0 ? `${formatDuration(napMinutes)} (${napCount}회)` : '없음'
  return (
    <section
      aria-label="총 수면 시간"
      className="flex flex-col gap-1 rounded-card bg-soft px-[18px] py-4 text-soft-text"
    >
      <span className="text-sm">
        밤잠 {night} + 낮잠 {nap}
      </span>
      <strong className="text-2xl tracking-[-0.3px]">총 {formatDuration(totalMinutes)}</strong>
    </section>
  )
}
