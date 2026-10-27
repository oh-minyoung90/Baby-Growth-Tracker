import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form'
import { invalidProps } from '@/components/form/invalidProps'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { acceptDecimalInput } from './bodySchema'

/**
 * 키·몸무게 숫자 칸: 오른쪽에 단위(cm, kg)를 표시하고, 소수점 첫째 자리까지만 입력된다 (FR-BODY-02).
 * 오류 문구는 두 칸 아래에 한 줄로 보여 주므로 여기서는 그리지 않는다 (BodyForm).
 */
export function MeasureField<T extends FieldValues, TOut = T>({
  control,
  name,
  id,
  label,
  unit,
  placeholder,
}: {
  control: Control<T, unknown, TOut>
  name: FieldPath<T>
  id: string
  label: string
  unit: string
  placeholder?: string
}) {
  const {
    field: { ref, value: rawValue, onChange, ...field },
    fieldState,
  } = useController({ control, name })
  const value = typeof rawValue === 'string' ? rawValue : ''

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        <span className="sr-only"> ({unit})</span>
      </Label>
      <div className="relative">
        <Input
          {...field}
          ref={ref}
          id={id}
          value={value}
          onChange={(event) => onChange(acceptDecimalInput(event.target.value, value))}
          inputMode="decimal"
          autoComplete="off"
          placeholder={placeholder}
          // 단위 글자 자리를 비워 둔다 (테두리가 2px가 되면 1px 줄여 글자가 움직이지 않게)
          className="pr-11 focus-visible:pr-[43px] aria-invalid:pr-[43px]"
          {...invalidProps(id, fieldState.error?.message)}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-muted-foreground"
        >
          {unit}
        </span>
      </div>
    </div>
  )
}
