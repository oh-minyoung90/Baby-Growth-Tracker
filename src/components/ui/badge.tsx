import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import { cn } from '@/lib/utils'

// 배지: 기록 유형(유형 색), 주의, 계획, 상태. 색만으로 구분하지 않도록 글자를 함께 쓴다 (docs/디자인.md 2.4)
const badgeVariants = cva(
  'inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 rounded-full border border-transparent px-2.5 text-xs font-bold whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3.5',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        soft: 'bg-soft text-soft-text',
        outline: 'border-line text-foreground',
        word: 'bg-type-word text-type-word-text',
        behavior: 'bg-type-behavior text-type-behavior-text',
        expression: 'bg-type-expression text-type-expression-text',
        food: 'bg-type-food text-type-food-text',
        measure: 'bg-type-measure text-type-measure-text',
        tried: 'bg-tried text-tried-text',
        caution: 'bg-danger-soft text-danger-text',
        plan: 'border-dashed border-soft-text text-soft-text',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({
  className,
  variant = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span'

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- shadcn 관례
export { Badge, badgeVariants }
