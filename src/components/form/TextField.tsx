import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field } from './Field'
import { invalidProps } from './invalidProps'

/**
 * 글자 수 제한 입력칸 (FR-COM-11): 제한에 도달하면 더 입력되지 않고, 라벨 오른쪽에 "5 / 30"을 표시한다.
 * React Hook Form의 control과 name을 받아 값·오류를 직접 연결한다.
 * 앞뒤 공백 제거와 빈 값 검사는 스키마(lib/validation.ts의 requiredText, optionalText)에서 한다.
 */
export function TextField<T extends FieldValues, TOut = T>({
  control,
  name,
  label,
  maxLength,
  multiline = false,
  placeholder,
  id = `field-${name}`,
}: {
  /** useForm의 control. 스키마가 값을 바꿔도(공백 제거, 빈 값 → null) 그대로 넘기면 된다 */
  control: Control<T, unknown, TOut>
  name: FieldPath<T>
  label: string
  maxLength: number
  /** 여러 줄 입력 (메모) */
  multiline?: boolean
  placeholder?: string
  id?: string
}) {
  const {
    field: { ref, value: rawValue, ...field },
    fieldState,
  } = useController({ control, name })
  const value = typeof rawValue === 'string' ? rawValue : ''
  const error = fieldState.error?.message
  const props = {
    ...field,
    id,
    value,
    placeholder,
    maxLength,
    autoComplete: 'off',
    ...invalidProps(id, error),
  }

  return (
    <Field
      id={id}
      label={label}
      error={error}
      aside={
        <span className="text-[13px] text-muted-foreground tabular-nums" aria-hidden>
          {value.length} / {maxLength}
        </span>
      }
    >
      {multiline ? <Textarea ref={ref} {...props} /> : <Input ref={ref} {...props} />}
    </Field>
  )
}
