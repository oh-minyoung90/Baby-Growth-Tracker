import type { LucideIcon } from 'lucide-react'
import { CalendarCheck, CalendarX, NotebookPen, TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatDateLabel } from '@/domain/date'
import type { Food } from '@/lib/foodApi'
import { foodGroupLabel, foodPreferenceLabel, type FoodPreference } from '@/lib/foodTypes'
import { cn } from '@/lib/utils'
import { firstLine } from './foodFilter'

/**
 * 음식 목록, 이름 가나다순 (FR-FOOD-03). 누르면 수정 시트가 열린다.
 * 탭별 표시: 먹어봄 = 식품군·처음 먹은 날·반응·"주의" 태그 / 아직 안 먹어봄 = 식품군·메모 /
 * 알러지·주의 = 반응 날짜·증상 메모 첫 줄. 먹은 횟수는 식단 기록이 생기는 T-46에서 더한다.
 */
export function FoodList({
  foods,
  onSelect,
}: {
  foods: readonly Food[]
  onSelect: (id: string) => void
}) {
  return (
    <ul aria-label="음식" className="divide-y overflow-hidden rounded-card border bg-surface">
      {foods.map((food) => (
        <li key={food.id}>
          <button
            type="button"
            onClick={() => onSelect(food.id)}
            className="flex min-h-15 w-full items-center gap-3 px-4 py-3 text-left transition-colors outline-none hover:bg-muted focus-visible:bg-muted"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="flex min-w-0 items-center gap-1.5">
                <strong className="truncate text-base font-medium">{food.name}</strong>
                {/* 알러지·주의는 색만이 아니라 경고 아이콘과 "주의" 글자로 알린다 (FR-FOOD-14) */}
                {(food.cautionTag || food.status === 'caution') && (
                  <Badge variant="caution" className="h-5 px-1.5 text-[11px]">
                    <TriangleAlert aria-hidden />
                    주의
                  </Badge>
                )}
              </span>
              <FoodDetails food={food} />
            </span>
            {food.status === 'tried' && <Preference value={food.preference} />}
          </button>
        </li>
      ))}
    </ul>
  )
}

function FoodDetails({ food }: { food: Food }) {
  if (food.status === 'caution') {
    const symptom = firstLine(food.symptomNote)
    return (
      <span className="flex min-w-0 flex-col gap-1 md:flex-row md:items-center md:gap-3">
        <Detail
          icon={CalendarX}
          label="반응 날짜"
          value={food.reactionDate ? formatDateLabel(food.reactionDate) : '모름'}
          known={food.reactionDate !== null}
        />
        {symptom && <Note icon={NotebookPen} text={symptom} />}
      </span>
    )
  }

  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
      <GroupLabel food={food} />
      {food.status === 'tried' ? (
        <Detail
          icon={CalendarCheck}
          label="처음 먹은 날"
          value={food.firstTriedDate ? formatDateLabel(food.firstTriedDate) : '모름'}
          known={food.firstTriedDate !== null}
        />
      ) : (
        food.memo && <Note icon={NotebookPen} text={firstLine(food.memo) ?? ''} />
      )}
    </span>
  )
}

/** 식품군: 값과 구분되도록 연한 배지로 둔다 */
function GroupLabel({ food }: { food: Food }) {
  return (
    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {foodGroupLabel(food.group)}
    </span>
  )
}

/** 아이콘 + 이름(흐린 글자) + 값. 값을 모르면 값도 흐리게 */
function Detail({
  icon: Icon,
  label,
  value,
  known,
}: {
  icon: LucideIcon
  label: string
  value: string
  known: boolean
}) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-[13px] md:text-sm">
      <Icon className="size-3.5 shrink-0 text-soft-text" aria-hidden />
      <span className="text-muted-foreground">{label}</span>{' '}
      <span className={cn('font-medium', !known && 'font-normal text-muted-foreground')}>
        {value}
      </span>
    </span>
  )
}

/** 메모 첫 줄: 길면 줄여서 보여 준다 */
function Note({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground md:text-sm">
      <Icon className="size-3.5 shrink-0 text-soft-text" aria-hidden />
      <span className="truncate">{text}</span>
    </span>
  )
}

const PREFERENCE_COLORS: Record<FoodPreference, string> = {
  like: 'text-tried-text',
  neutral: 'text-foreground',
  refuse: 'text-danger',
}

/** 아이 반응 (FR-FOOD-10). 고르지 않았으면 "미입력" */
function Preference({ value }: { value: FoodPreference | null }) {
  return (
    <span className="flex shrink-0 flex-col items-end gap-0.5">
      <span className="text-xs text-muted-foreground">반응</span>{' '}
      <strong
        className={cn(
          'text-[15px]',
          value ? PREFERENCE_COLORS[value] : 'font-normal text-muted-foreground',
        )}
      >
        {value ? foodPreferenceLabel(value) : '미입력'}
      </strong>
    </span>
  )
}
