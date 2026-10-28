import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useController, useForm, useWatch, type Control } from 'react-hook-form'
import { DeleteRecordButton } from '@/components/DeleteRecordButton'
import { ErrorBanner } from '@/components/ErrorBanner'
import { DateField } from '@/components/form/DateField'
import { FieldError } from '@/components/form/Field'
import { TextField } from '@/components/form/TextField'
import { FormActions } from '@/components/FormPage'
import { NoticeDialog } from '@/components/NoticeDialog'
import { Button } from '@/components/ui/button'
import { calculateAge, formatAge } from '@/domain/age'
import { formatDateLabel, isValidDateString, todayString } from '@/domain/date'
import { NETWORK_ERROR_MESSAGES } from '@/lib/messages'
import { MILESTONE_TYPES, milestoneTypeInfo, type MilestoneType } from '@/lib/milestoneTypes'
import { notifySaved } from '@/lib/notify'
import { MilestoneSaveError, type Milestone, type MilestoneInput } from '@/lib/milestoneApi'
import { duplicateKey, findDuplicate, similarMilestones } from './milestoneMatch'
import {
  MEMO_MAX,
  TITLE_MAX,
  duplicateMessage,
  milestoneSchema,
  serverFieldError,
  type MilestoneFormValues,
} from './milestoneSchema'
import {
  useDeleteMilestone,
  useEnsureMilestones,
  useMilestones,
  useSaveMilestone,
} from '@/lib/useMilestones'

type FormControl = Control<MilestoneFormValues, unknown, MilestoneInput>

/** 발달 기록 입력·수정 폼 (SCR-05, FR-MS-01~07, FR-COM-30~31) */
export function MilestoneForm({
  initial,
  defaultType,
  birthDate,
  onDone,
}: {
  /** 수정할 기록. 없으면 새 기록 */
  initial?: Milestone
  /** 새 기록일 때 미리 고를 유형 (빠른 기록에서 "단어"로 들어온 경우 등, FR-MS-01) */
  defaultType?: MilestoneType
  birthDate: string
  /** 저장·삭제·취소 후 진입했던 화면으로 돌아간다 */
  onDone: () => void
}) {
  const save = useSaveMilestone()
  const remove = useDeleteMilestone()
  const milestones = useMilestones()
  const ensureMilestones = useEnsureMilestones()
  const [failed, setFailed] = useState<'save' | 'delete' | null>(null)
  // 같은 유형·내용으로 이미 있는 기록. 저장하지 않고 안내 창으로 알린다 (FR-MS-06)
  const [duplicate, setDuplicate] = useState<Milestone | null>(null)
  // 닫히는 동안에도 문구가 남아 있도록 열림 상태를 따로 둔다
  const [duplicateOpen, setDuplicateOpen] = useState(false)
  // 수정할 때 원래 유형·내용 그대로면 같은 내용을 찾지 않는다 (변경 전에 저장된 같은 내용도 날짜·메모는 고칠 수 있게)
  const originalKey = initial ? duplicateKey(initial) : null

  const {
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { isSubmitted, isSubmitting },
  } = useForm<MilestoneFormValues, unknown, MilestoneInput>({
    resolver: zodResolver(milestoneSchema(birthDate)),
    defaultValues: {
      type: initial?.type ?? defaultType ?? '',
      date: initial?.date ?? todayString(),
      title: initial?.title ?? '',
      memo: initial?.memo ?? '',
    },
  })
  const [type, date, title] = useWatch({ control, name: ['type', 'date', 'title'] })
  const typeInfo = type ? milestoneTypeInfo(type) : undefined
  // 날짜를 바꾸면 바로 다시 계산한다 (FR-MS-03)
  const age =
    isValidDateString(date) && date >= birthDate && date <= todayString()
      ? formatAge(calculateAge(birthDate, date))
      : null
  const similar = similarMilestones(milestones.data ?? [], { type, title }, initial?.id)

  const onSubmit = handleSubmit(async (input) => {
    setFailed(null)
    // 같은 유형에 같은 내용이 있으면 저장하지 않고 안내 창을 띄운다 (FR-MS-06)
    if (duplicateKey(input) !== originalKey) {
      let records: Milestone[]
      try {
        records = await ensureMilestones()
      } catch {
        setFailed('save')
        return
      }
      const record = findDuplicate(records, input, initial?.id)
      if (record) {
        setDuplicate(record)
        setDuplicateOpen(true)
        return
      }
    }
    try {
      await save.mutateAsync({ id: initial?.id, input })
      notifySaved()
      onDone()
    } catch (error) {
      // 서버(DB) 검증에 걸리면 화면 검증과 같은 자리에 같은 문구로 알린다 (FR-COM-13)
      const fieldError = serverFieldError(
        error instanceof MilestoneSaveError ? error.reason : 'network',
        input.type,
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

      <TypeField control={control} />

      <div className="flex flex-col gap-1.5">
        <DateField
          control={control}
          name="date"
          id="ms-date"
          label="날짜"
          min={birthDate}
          max={todayString()}
        />
        {age && (
          <p aria-live="polite" className="text-[13px] font-bold text-soft-text">
            {age}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <TextField
          control={control}
          name="title"
          id="ms-title"
          label="내용"
          placeholder={typeInfo?.placeholder ?? '유형을 먼저 골라 주세요'}
          maxLength={TITLE_MAX}
        />
        {similar.length > 0 && <SimilarList records={similar} />}
      </div>

      {/* 행동·표정·놀이는 기본 예시를 누르면 내용 칸에 채운다. 단어는 예시 없음 (FR-MS-04) */}
      {typeInfo && typeInfo.examples.length > 0 && (
        <div className="flex flex-col gap-2">
          <span id="ms-examples-label" className="text-sm font-bold">
            예시에서 고르기
          </span>
          <div role="group" aria-labelledby="ms-examples-label" className="flex flex-wrap gap-2">
            {typeInfo.examples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() =>
                  setValue('title', example, { shouldDirty: true, shouldValidate: isSubmitted })
                }
                className="h-10 rounded-full border border-line bg-surface px-3.5 text-sm transition-colors hover:bg-muted"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}

      <TextField
        control={control}
        name="memo"
        id="ms-memo"
        label="메모"
        placeholder="어떤 상황이었나요?"
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

      <NoticeDialog
        open={duplicateOpen}
        onOpenChange={setDuplicateOpen}
        title={duplicateMessage(duplicate?.type)}
        description={
          duplicate
            ? `"${duplicate.title}" · ${formatDateLabel(duplicate.date)}에 기록했어요`
            : undefined
        }
      />
    </form>
  )
}

/** 입력 중인 내용과 비슷한 이전 기록. 보여 주기만 한다 (FR-MS-05) */
function SimilarList({ records }: { records: Milestone[] }) {
  return (
    <section
      aria-labelledby="ms-similar-label"
      className="overflow-hidden rounded-input border border-line bg-surface"
    >
      <p
        id="ms-similar-label"
        className="bg-background px-3.5 py-2 text-xs font-bold text-muted-foreground"
      >
        이전에 기록한 비슷한 내용
      </p>
      <ul>
        {records.map((record) => (
          <li
            key={record.id}
            className="flex min-h-11 items-center justify-between gap-3 border-t border-line px-3.5 py-2 text-[15px]"
          >
            <span className="min-w-0 break-words">{record.title}</span>
            <span className="shrink-0 text-[13px] text-muted-foreground tabular-nums">
              {formatDateLabel(record.date)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** 유형 고르기: 단어·행동·표정·놀이 (FR-MS-01). 선택 상태는 보라색 (docs/디자인.md 2.4) */
function TypeField({ control }: { control: FormControl }) {
  const {
    field: { ref, value, onChange },
    fieldState,
  } = useController({ control, name: 'type' })
  const error = fieldState.error?.message

  return (
    <div className="flex flex-col gap-2">
      <span id="ms-type-label" className="text-sm font-bold">
        유형
      </span>
      <div
        role="radiogroup"
        aria-labelledby="ms-type-label"
        aria-describedby={error ? 'ms-type-error' : undefined}
        className="grid grid-cols-4 gap-2"
      >
        {MILESTONE_TYPES.map(({ value: option, label, icon: Icon }, index) => (
          <button
            key={option}
            // 저장할 때 유형이 비어 있으면 첫 버튼으로 초점을 옮긴다
            ref={index === 0 ? ref : undefined}
            type="button"
            role="radio"
            aria-checked={value === option}
            onClick={() => onChange(option)}
            className="flex h-16 flex-col items-center justify-center gap-1 rounded-xl border border-line bg-surface text-sm font-bold text-muted-foreground transition-colors aria-checked:border-2 aria-checked:border-primary aria-checked:bg-soft aria-checked:text-soft-text"
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </button>
        ))}
      </div>
      {error && <FieldError id="ms-type-error">{error}</FieldError>}
    </div>
  )
}
