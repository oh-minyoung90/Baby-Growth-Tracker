import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DeleteRecordButton } from '@/components/DeleteRecordButton'
import { ErrorBanner } from '@/components/ErrorBanner'
import { DateField } from '@/components/form/DateField'
import { FieldError } from '@/components/form/Field'
import { TextField } from '@/components/form/TextField'
import { Button } from '@/components/ui/button'
import { todayString } from '@/domain/date'
import { NETWORK_ERROR_MESSAGES } from '@/lib/messages'
import { notifySaved } from '@/lib/notify'
import { BodySaveError, type BodyMeasure, type BodyMeasureInput } from './bodyApi'
import {
  BODY_MESSAGES,
  MEMO_MAX,
  bodyMeasureSchema,
  serverFieldError,
  type BodyFormValues,
} from './bodySchema'
import { MeasureField } from './MeasureField'
import { useDeleteBodyMeasure, useSaveBodyMeasure } from './useBodyMeasures'

/** 키·몸무게 입력·수정 폼 (FR-BODY-01~02, 06, FR-COM-30~31). 바텀 시트 안에 놓인다 */
export function BodyForm({
  initial,
  birthDate,
  measures,
  onDone,
  onEditExisting,
}: {
  /** 수정할 기록. 없으면 새 기록 */
  initial?: BodyMeasure
  birthDate: string
  /** 같은 날짜 기록이 있는지 확인할 때 쓴다 (FR-BODY-06) */
  measures: BodyMeasure[]
  /** 저장·삭제·취소 후 시트를 닫는다 */
  onDone: () => void
  /** 같은 날짜의 기존 기록을 수정 시트로 연다 */
  onEditExisting: (id: string) => void
}) {
  const save = useSaveBodyMeasure()
  const remove = useDeleteBodyMeasure()
  const [sameDateRecord, setSameDateRecord] = useState<BodyMeasure | null>(null)
  const [failed, setFailed] = useState<'save' | 'delete' | null>(null)

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<BodyFormValues, unknown, BodyMeasureInput>({
    resolver: zodResolver(bodyMeasureSchema(birthDate)),
    defaultValues: {
      date: initial?.date ?? todayString(),
      // 목록과 같이 소수점 첫째 자리까지 보여 준다 (9 → '9.0')
      heightCm: initial?.heightCm?.toFixed(1) ?? '',
      weightKg: initial?.weightKg?.toFixed(1) ?? '',
      memo: initial?.memo ?? '',
    },
  })

  const submit = async (input: BodyMeasureInput) => {
    setFailed(null)
    try {
      await save.mutateAsync({ id: initial?.id, input })
      notifySaved()
      onDone()
    } catch (error) {
      // 서버(DB) 검증에 걸리면 화면 검증과 같은 자리에 같은 문구로 알린다 (FR-COM-13)
      const fieldError = serverFieldError(error instanceof BodySaveError ? error.reason : 'network')
      if (fieldError) setError(fieldError.field, { message: fieldError.message })
      else setFailed('save')
    }
  }

  const onSubmit = handleSubmit((input) => {
    // 측정 기록은 날짜마다 1건이다 (FR-BODY-06). 그날 기록이 있으면 저장하지 않고 기존 기록 수정을 권한다
    const sameDate = measures.find(
      (measure) => measure.id !== initial?.id && measure.date === input.date,
    )
    if (sameDate) {
      setSameDateRecord(sameDate)
      return
    }
    void submit(input)
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

      <DateField
        control={control}
        name="date"
        id="body-date"
        label="측정 날짜"
        min={birthDate}
        max={todayString()}
      />

      <div className="flex flex-col gap-1.5">
        <div className="grid grid-cols-2 gap-2.5">
          <MeasureField
            control={control}
            name="heightCm"
            id="body-height"
            label="키"
            unit="cm"
            placeholder="72.5"
          />
          <MeasureField
            control={control}
            name="weightKg"
            id="body-weight"
            label="몸무게"
            unit="kg"
            placeholder="9.0"
          />
        </div>
        {/* 두 칸의 오류는 칸이 좁아 아래에 한 줄로 보여 준다 */}
        {errors.heightCm?.message && (
          <FieldError id="body-height-error">{errors.heightCm.message}</FieldError>
        )}
        {errors.weightKg?.message && (
          <FieldError id="body-weight-error">{errors.weightKg.message}</FieldError>
        )}
        <p className="text-[13px] text-muted-foreground">키와 몸무게 중 하나만 입력해도 돼요</p>
      </div>

      <TextField
        control={control}
        name="memo"
        id="body-memo"
        label="메모"
        placeholder="예: 영유아 검진"
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
      {initial && (
        <DeleteRecordButton onConfirm={() => void onDelete()} pending={remove.isPending} />
      )}

      <ConfirmDialog
        open={sameDateRecord !== null}
        onOpenChange={(open) => !open && setSameDateRecord(null)}
        title={BODY_MESSAGES.duplicateDate}
        description="측정 기록은 하루에 하나만 남길 수 있어요. 그날 기록을 수정할까요?"
        confirmLabel="기존 기록 수정"
        onConfirm={() => {
          if (sameDateRecord) onEditExisting(sameDateRecord.id)
        }}
      />
    </form>
  )
}
