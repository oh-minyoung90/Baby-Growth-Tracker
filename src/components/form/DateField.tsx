import type { ComponentProps, MouseEvent } from 'react'
import { CalendarDays } from 'lucide-react'
import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form'
import { formatDateLabel, isValidDateString } from '@/domain/date'
import { cn } from '@/lib/utils'
import { Field } from './Field'
import { invalidProps } from './invalidProps'

/** 클릭한 곳과 상관없이 달력을 연다 (지원하지 않는 브라우저는 기본 동작을 따른다) */
function openPicker(event: MouseEvent<HTMLInputElement>) {
  try {
    event.currentTarget.showPicker?.()
  } catch {
    // 이미 열려 있거나 브라우저가 막은 경우: 기본 동작으로 충분하다
  }
}

/**
 * 날짜 입력칸 (FR-COM-02~05). 폼 밖에서도 쓸 수 있는 화면 부분이다 (타임라인 기간 필터 등).
 * 브라우저 기본 달력을 쓰되, 값은 "2026. 10. 14. (수)"처럼 요일과 함께 보여 준다.
 * 화면에 보이는 칸 위에 투명한 날짜 입력칸을 겹쳐 두어, 누르면 기기의 달력이 열린다.
 */
export function DateInput({
  value,
  className,
  ...props
}: Omit<ComponentProps<'input'>, 'type' | 'value'> & { value: string }) {
  const valid = isValidDateString(value)
  return (
    <div className={cn('relative', className)}>
      <input
        {...props}
        type="date"
        value={value}
        onClick={openPicker}
        className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0"
      />
      <div
        aria-hidden
        className={cn(
          'flex h-12 items-center justify-between gap-2 rounded-input border border-line bg-surface px-3.5 text-base transition-colors',
          'peer-focus-visible:border-2 peer-focus-visible:border-primary peer-focus-visible:px-[13px]',
          'peer-aria-invalid:border-2 peer-aria-invalid:border-danger peer-aria-invalid:px-[13px]',
        )}
      >
        <span className={cn(!valid && 'text-muted-foreground')}>
          {valid ? formatDateLabel(value) : '날짜를 선택해 주세요'}
        </span>
        <CalendarDays className="size-5 shrink-0 text-muted-foreground" />
      </div>
    </div>
  )
}

/**
 * React Hook Form용 날짜 입력 (라벨 + DateInput + 오류 문구).
 * min·max는 달력에서 고를 수 있는 범위다. 직접 입력한 값은 스키마(lib/validation.ts의 recordDate)에서 한 번 더 검사한다.
 * 기본값(오늘)은 폼의 defaultValues에서 정한다.
 */
export function DateField<T extends FieldValues, TOut = T>({
  control,
  name,
  label,
  min,
  max,
  id = `field-${name}`,
}: {
  /** useForm의 control. 스키마가 값을 바꿔도(공백 제거, 빈 값 → null) 그대로 넘기면 된다 */
  control: Control<T, unknown, TOut>
  name: FieldPath<T>
  label: string
  /** 'YYYY-MM-DD'. 보통 생년월일 */
  min?: string
  /** 'YYYY-MM-DD'. 보통 오늘 (주간 식단은 비워 둔다) */
  max?: string
  id?: string
}) {
  const {
    field: { value, ...field },
    fieldState,
  } = useController({ control, name })
  const error = fieldState.error?.message

  return (
    <Field id={id} label={label} error={error}>
      <DateInput
        {...field}
        id={id}
        value={typeof value === 'string' ? value : ''}
        min={min}
        max={max}
        {...invalidProps(id, error)}
      />
    </Field>
  )
}
