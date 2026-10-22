import * as React from 'react'
import { Label as LabelPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

// 입력칸 라벨: 14px 굵게 (docs/디자인.md 3장)
function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        'flex items-center gap-2 text-sm leading-snug font-bold select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Label }
