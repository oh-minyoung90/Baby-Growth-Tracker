import * as React from 'react'
import { Dialog as SheetPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

// 바텀 시트: 아래에서 올라오는 입력 창. 위쪽 손잡이 막대, 위 모서리 24px (docs/디자인.md 5·6장)
// 키·몸무게, 식단 칸, 알러지 지정 입력에 쓴다. PC(768px 이상)에서는 화면 가운데 카드로 띄운다.

function Sheet(props: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content>) {
  const contentRef = React.useRef<HTMLDivElement>(null)
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay
        data-slot="sheet-overlay"
        className="fixed inset-0 z-50 bg-scrim data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
      />
      <SheetPrimitive.Content
        ref={contentRef}
        data-slot="sheet-content"
        // 열 때 첫 입력칸 대신 시트에 초점을 둔다 (휴대폰에서 키보드·달력이 바로 뜨지 않게)
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          contentRef.current?.focus()
        }}
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col gap-4 overflow-y-auto rounded-t-sheet bg-surface px-5 pt-3 pb-[calc(24px+env(safe-area-inset-bottom))] text-foreground outline-none',
          'data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom-10 data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-bottom-10',
          'md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-[calc(100%-48px)] md:max-w-120 md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-sheet md:p-6',
          className,
        )}
        {...props}
      >
        <div aria-hidden className="mx-auto h-1 w-10 shrink-0 rounded-full bg-line md:hidden" />
        {children}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  )
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn('text-lg font-bold', className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-[15px] text-muted-foreground', className)}
      {...props}
    />
  )
}

export { Sheet, SheetContent, SheetDescription, SheetTitle }
