import { useState } from 'react'
import { ErrorBanner } from '@/components/ErrorBanner'
import { ListLoading } from '@/components/ListLoading'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import type { MealEntry } from '@/lib/mealApi'
import type { MealType } from '@/lib/mealTypes'
import { NETWORK_ERROR_MESSAGES } from '@/lib/messages'
import { MealForm } from './MealForm'

export interface MealEditor {
  date: string
  type: MealType
  initial?: MealEntry
}
export function MealSheet({
  open,
  editor,
  editing,
  loading,
  failed,
  onRetry,
  birthDate,
  onClose,
}: {
  open: boolean
  editor: MealEditor | null
  editing: boolean
  loading: boolean
  failed: boolean
  onRetry: () => void
  birthDate?: string
  onClose: () => void
}) {
  const [shown, setShown] = useState(editor)
  const [pending, setPending] = useState(false)
  // 닫히는 동안에는 직전에 열었던 내용을 유지한다.
  if (open && editor && shown !== editor) setShown(editor)
  const unavailable = open && !editor
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) onClose()
      }}
    >
      <SheetContent
        aria-describedby={undefined}
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault()
        }}
        onPointerDownOutside={(event) => {
          if (pending) event.preventDefault()
        }}
      >
        <SheetTitle>
          {open
            ? editing
              ? '식단 수정'
              : '식단 기록'
            : shown?.initial
              ? '식단 수정'
              : '식단 기록'}
        </SheetTitle>
        {unavailable ? (
          loading ? (
            <ListLoading rows={2} />
          ) : failed ? (
            <ErrorBanner message={NETWORK_ERROR_MESSAGES.load} onRetry={onRetry} />
          ) : (
            <>
              <p role="alert" className="text-sm text-muted-foreground">
                식단을 찾을 수 없어요. 날짜와 끼니를 다시 골라 주세요
              </p>
              <Button type="button" variant="soft" onClick={onClose}>
                닫기
              </Button>
            </>
          )
        ) : (
          shown && (
            <MealForm
              key={shown.initial?.id ?? `${shown.date}:${shown.type}`}
              {...shown}
              birthDate={birthDate}
              onDone={onClose}
              onPendingChange={setPending}
            />
          )
        )}
      </SheetContent>
    </Sheet>
  )
}
