import type { ComponentProps, MouseEvent } from 'react'
import { cn } from '@/lib/utils'

function openPicker(event: MouseEvent<HTMLInputElement>) {
  try {
    event.currentTarget.showPicker?.()
  } catch {
    // showPicker 미지원·차단 시에도 투명한 input의 기본 시간 선택은 유지한다.
  }
}

/** DateInput과 같은 방식으로 기기 시간 선택과 화면 표시를 분리한다. */
export function TimeInput({
  value,
  className,
  onClick,
  ...props
}: Omit<ComponentProps<'input'>, 'type' | 'value'> & { value: string }) {
  return (
    <div className={cn('relative min-w-0 overflow-hidden rounded-input', className)}>
      {/* iOS 날짜/시간 컨트롤은 padding·기본 외형 때문에 너비가 커질 수 있다. */}
      <input
        {...props}
        type="time"
        value={value}
        onClick={(event) => {
          onClick?.(event)
          if (!event.defaultPrevented) openPicker(event)
        }}
        className="peer absolute inset-0 z-10 m-0 h-full w-full min-w-0 max-w-full cursor-pointer appearance-none border-0 p-0 text-base opacity-0 disabled:cursor-not-allowed"
      />
      <div
        aria-hidden
        className={cn(
          'flex h-12 min-w-0 items-center rounded-input border border-line bg-surface px-3.5 text-base text-foreground transition-colors',
          'peer-focus-visible:border-2 peer-focus-visible:border-primary peer-focus-visible:px-[13px]',
          'peer-aria-invalid:border-2 peer-aria-invalid:border-danger peer-aria-invalid:px-[13px]',
          'peer-disabled:bg-disabled peer-disabled:text-disabled-text',
        )}
      >
        <span className={cn('truncate', !value && 'text-muted-foreground')}>
          {value || '시간 선택'}
        </span>
      </div>
    </div>
  )
}
