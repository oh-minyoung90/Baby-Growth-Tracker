import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import { cn } from '@/lib/utils'

// docs/디자인.md 6장: 기본 · 보조 · 외곽선 · 삭제 버튼, 높이 48px(하단 주요 버튼 52px), 모서리 14px
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-button border border-transparent text-base font-bold whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:bg-disabled disabled:text-disabled-text [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        soft: 'bg-soft text-soft-text hover:bg-soft/80',
        outline: 'border-line bg-surface font-medium text-foreground hover:bg-muted',
        destructive: 'bg-danger text-on-danger hover:bg-danger/90 focus-visible:ring-danger/40',
        ghost: 'font-medium text-muted-foreground hover:bg-muted hover:text-foreground',
        link: 'h-auto px-0 text-soft-text underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-12 px-5',
        lg: 'h-13 px-6',
        sm: 'h-10 rounded-input px-3.5 text-sm',
        icon: 'size-11 rounded-input',
        fab: "size-15 rounded-[20px] shadow-lg shadow-primary/35 [&_svg:not([class*='size-'])]:size-7",
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- shadcn 관례: 링크 등에 같은 스타일을 쓰기 위해 함께 내보낸다
export { Button, buttonVariants }
