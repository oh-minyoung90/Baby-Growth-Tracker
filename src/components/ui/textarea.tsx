import * as React from 'react'
import { cn } from '@/lib/utils'

// Input과 같은 규칙: 모서리 12px, 포커스 보라 2px, 오류 코랄 2px, 글자 16px
function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex field-sizing-content min-h-20 w-full resize-none rounded-input border border-line bg-surface px-3.5 py-3 text-base text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-2 focus-visible:border-primary focus-visible:px-[13px] focus-visible:py-[11px] disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-text aria-invalid:border-2 aria-invalid:border-danger',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
