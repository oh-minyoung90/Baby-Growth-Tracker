import * as React from 'react'
import { cn } from '@/lib/utils'

// docs/디자인.md 6장: 높이 48px, 모서리 12px, 포커스 보라 2px, 오류 코랄 2px.
// 글자는 16px 이상 유지 (iOS에서 16px 미만이면 입력할 때 화면이 확대됨)
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-12 w-full min-w-0 rounded-input border border-line bg-surface px-3.5 text-base text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-2 focus-visible:border-primary focus-visible:px-[13px] disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-text aria-invalid:border-2 aria-invalid:border-danger aria-invalid:px-[13px]',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
