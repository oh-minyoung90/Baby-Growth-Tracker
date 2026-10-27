import type { ReactNode } from 'react'
import { CircleAlert } from 'lucide-react'
import { Label } from '@/components/ui/label'

/** 입력칸 바로 아래 오류 문구: 코랄 글자 + 원 안 느낌표 (docs/디자인.md 6장, 기능요구사항서 3.4) */
export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="flex items-center gap-1.5 text-sm text-danger">
      <CircleAlert className="size-4 shrink-0" aria-hidden />
      {children}
    </p>
  )
}

/** 라벨(+ 오른쪽 보조 정보) · 입력칸 · 오류 문구 묶음 */
export function Field({
  id,
  label,
  error,
  aside,
  children,
}: {
  id: string
  label: string
  error?: string
  /** 라벨 오른쪽에 둘 내용 (글자 수 등) */
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {aside}
      </div>
      {children}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  )
}
