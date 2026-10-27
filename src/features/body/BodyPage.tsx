import { useState } from 'react'
import { Ruler } from 'lucide-react'
import { AddRecordButton } from '@/components/AddRecordButton'
import { EmptyState } from '@/components/EmptyState'
import { ErrorBanner } from '@/components/ErrorBanner'
import { ListLoading } from '@/components/ListLoading'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { calculateAge, formatAge } from '@/domain/age'
import { formatDateLabel } from '@/domain/date'
import { NETWORK_ERROR_MESSAGES } from '@/lib/messages'
import { useChild } from '@/lib/useChild'
import { useSheetParam } from '@/lib/useSheetParam'
import type { BodyMeasure } from './bodyApi'
import { BodyForm } from './BodyForm'
import { useBodyMeasures } from './useBodyMeasures'

/**
 * 성장 > 키·몸무게 (SCR-04): 측정 목록과 입력 시트 (T-16). 차트는 T-17에서 목록 위에 둔다.
 * 입력·수정 시트는 주소로 연다: ?record=new, ?record=<id> (useSheetParam)
 */
export function BodyPage() {
  const { data: child } = useChild()
  const measures = useBodyMeasures()
  const sheet = useSheetParam()

  const editing =
    sheet.value && sheet.value !== 'new'
      ? measures.data?.find((measure) => measure.id === sheet.value)
      : undefined
  const sheetOpen = sheet.value === 'new' || editing !== undefined

  return (
    // 모바일에서 떠 있는 추가 버튼이 마지막 기록을 가리지 않게 아래를 비운다
    <div className="flex flex-col gap-3 pb-20 md:pb-0">
      <div className="flex min-h-12 items-center justify-between gap-3">
        <h2 className="text-base font-bold">측정 기록</h2>
        <AddRecordButton label="측정 기록 추가" onClick={() => sheet.open('new')} />
      </div>

      {measures.isPending ? (
        <ListLoading />
      ) : measures.isError ? (
        <ErrorBanner
          message={NETWORK_ERROR_MESSAGES.load}
          onRetry={() => void measures.refetch()}
          retrying={measures.isFetching}
        />
      ) : measures.data.length === 0 ? (
        <EmptyState
          icon={Ruler}
          title="아직 측정 기록이 없어요"
          description="키나 몸무게를 기록하면 자라는 모습을 한눈에 볼 수 있어요"
          onAction={() => sheet.open('new')}
        />
      ) : (
        <MeasureList
          measures={measures.data}
          birthDate={child?.birthDate}
          onSelect={(id) => sheet.open(id)}
        />
      )}

      {child && (
        <BodySheet
          open={sheetOpen}
          initial={editing}
          birthDate={child.birthDate}
          measures={measures.data ?? []}
          onClose={sheet.close}
          // 같은 날짜 기록으로 바꿔 열 때는 주소를 바꿔 끼워, 닫으면 시트를 열기 전 화면으로 돌아가게 한다
          onEditExisting={(id) => sheet.open(id, { replace: true })}
        />
      )}
    </div>
  )
}

function formatValue(value: number | null, unit: string): string {
  return value === null ? '-' : `${value.toFixed(1)}${unit}`
}

/** 생후 일수. 생년월일을 나중에 바꿔 기록 날짜가 더 이르면 표시하지 않는다 */
function ageLabel(birthDate: string | undefined, date: string): string | null {
  if (!birthDate || date < birthDate) return null
  return formatAge(calculateAge(birthDate, date))
}

/** 측정 목록, 최신순. 키나 몸무게 한쪽만 있으면 빈 값은 "-" (FR-BODY-05). 누르면 수정 (FR-COM-30) */
function MeasureList({
  measures,
  birthDate,
  onSelect,
}: {
  measures: BodyMeasure[]
  birthDate: string | undefined
  onSelect: (id: string) => void
}) {
  return (
    <ul className="divide-y overflow-hidden rounded-card border bg-surface">
      {measures.map((measure) => {
        const detail = [ageLabel(birthDate, measure.date), measure.memo].filter(Boolean).join(' · ')
        return (
          <li key={measure.id}>
            <button
              type="button"
              onClick={() => onSelect(measure.id)}
              className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors outline-none hover:bg-muted focus-visible:bg-muted"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-medium">{formatDateLabel(measure.date)}</span>
                {detail && (
                  <span className="truncate text-xs text-muted-foreground md:text-sm">
                    {detail}
                  </span>
                )}
              </span>
              <span className="w-16 text-right text-[15px] font-bold tabular-nums md:w-24">
                {formatValue(measure.heightCm, 'cm')}
              </span>
              <span className="w-14 text-right text-[15px] font-bold tabular-nums md:w-24">
                {formatValue(measure.weightKg, 'kg')}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** 입력·수정 바텀 시트 (docs/디자인.md 5장: 키·몸무게 입력은 시트) */
function BodySheet({
  open,
  initial,
  birthDate,
  measures,
  onClose,
  onEditExisting,
}: {
  open: boolean
  initial: BodyMeasure | undefined
  birthDate: string
  measures: BodyMeasure[]
  onClose: () => void
  onEditExisting: (id: string) => void
}) {
  // 닫히는 동안(애니메이션)에도 열려 있던 내용을 유지한다. 수정 시트가 닫히며 빈 입력 화면으로 바뀌어 보이지 않게
  const [shown, setShown] = useState(initial)
  if (open && shown !== initial) setShown(initial)

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      {/* 설명 문구가 없는 창이라 aria-describedby를 비운다 (Radix 경고 방지) */}
      <SheetContent aria-describedby={undefined}>
        <SheetTitle>{shown ? '키·몸무게 수정' : '키·몸무게 기록'}</SheetTitle>
        <BodyForm
          key={shown?.id ?? 'new'}
          initial={shown}
          birthDate={birthDate}
          measures={measures}
          onDone={onClose}
          onEditExisting={onEditExisting}
        />
      </SheetContent>
    </Sheet>
  )
}
