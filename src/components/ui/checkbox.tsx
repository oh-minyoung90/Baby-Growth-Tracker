import * as React from 'react'
import { CheckIcon } from 'lucide-react'
import { Checkbox as CheckboxPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

// 22px 체크박스. 바깥 투명 영역(after)으로 터치 영역 44px을 확보한다 (docs/디자인.md 4장)
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer relative flex size-5.5 shrink-0 items-center justify-center rounded-md border-2 border-line bg-surface transition-colors outline-none after:absolute after:-inset-2.5 focus-visible:ring-3 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current [&>svg]:size-4"
      >
        <CheckIcon strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
