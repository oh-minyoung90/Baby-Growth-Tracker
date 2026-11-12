import { useRef, useState } from 'react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import type { Food } from '@/lib/foodApi'
import { CautionForm } from './CautionForm'
import { FoodForm } from './FoodForm'

/** 추가·수정 바텀 시트. 수정 중에 알러지·주의 지정 화면으로 바뀔 수 있다 (R48) */
export function FoodSheet({
  open,
  initial,
  birthDate,
  foods,
  addTried,
  onClose,
  onEditExisting,
  onDeleted,
}: {
  open: boolean
  initial: Food | undefined
  birthDate: string
  foods: readonly Food[]
  addTried: boolean
  onClose: () => void
  onEditExisting: (id: string) => void
  onDeleted?: () => void
}) {
  // 닫히는 동안(애니메이션)에도 열려 있던 내용을 유지한다. 수정 시트가 닫히며 빈 입력 화면으로 바뀌어 보이지 않게
  const [shown, setShown] = useState(initial)
  if (open && shown !== initial) setShown(initial)

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      {/* 설명 문구가 없는 창이라 aria-describedby를 비운다 (Radix 경고 방지) */}
      <SheetContent aria-describedby={undefined}>
        <FoodSheetBody
          // 다른 음식을 열면 수정 화면부터 다시 시작한다
          key={shown?.id ?? 'new'}
          initial={shown}
          addTried={addTried}
          birthDate={birthDate}
          foods={foods}
          onClose={onClose}
          onEditExisting={onEditExisting}
          onDeleted={onDeleted}
        />
      </SheetContent>
    </Sheet>
  )
}

function FoodSheetBody({
  initial,
  addTried,
  birthDate,
  foods,
  onClose,
  onEditExisting,
  onDeleted,
}: {
  initial: Food | undefined
  addTried: boolean
  birthDate: string
  foods: readonly Food[]
  onClose: () => void
  onEditExisting: (id: string) => void
  onDeleted?: () => void
}) {
  const [designating, setDesignating] = useState(false)
  const titleRef = useRef<HTMLHeadingElement>(null)

  // 화면이 바뀌면 시트 맨 위로 올리고 시트에 초점을 둔다 (누른 버튼이 사라지므로)
  const switchTo = (next: boolean) => {
    setDesignating(next)
    const content = titleRef.current?.closest<HTMLElement>('[data-slot="sheet-content"]')
    if (content) {
      content.scrollTop = 0
      content.focus()
    }
  }

  if (initial && designating) {
    return (
      <>
        <SheetTitle ref={titleRef}>알러지·주의 지정</SheetTitle>
        <CautionForm
          food={initial}
          birthDate={birthDate}
          onCancel={() => switchTo(false)}
          onDone={onClose}
        />
      </>
    )
  }

  const title = initial ? '음식 수정' : addTried ? '먹어 본 음식 추가' : '안 먹어 본 음식 추가'
  return (
    <>
      <SheetTitle ref={titleRef}>{title}</SheetTitle>
      <FoodForm
        initial={initial}
        addTried={addTried}
        birthDate={birthDate}
        foods={foods}
        onDone={onClose}
        onEditExisting={onEditExisting}
        onDeleted={onDeleted}
        onDesignate={() => switchTo(true)}
      />
    </>
  )
}
