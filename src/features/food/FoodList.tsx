import type { LucideIcon } from 'lucide-react'
import { CalendarCheck, CalendarX, NotebookPen, TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatDateLabel } from '@/domain/date'
import type { Food } from '@/lib/foodApi'
import { foodGroupLabel, foodPreferenceLabel, type FoodPreference } from '@/lib/foodTypes'
import { cn } from '@/lib/utils'
import { firstLine } from './foodFilter'

/**
 * 음식 목록, 이름 가나다순 (FR-FOOD-03). 누르면 음식 상세로 이동한다.
 * 탭별 표시: 먹어봄 = 식품군·처음 먹은 날·반응·"주의" 태그 / 아직 안 먹어봄 = 식품군·메모 /
 * 알러지·주의 = 반응 날짜·증상 메모 첫 줄. 먹은 횟수는 먹음 체크된 직접 음식 식단만 센다.
 */
export function FoodList({
  foods,
  onSelect,
  counts,
}: {
  foods: readonly Food[]
  onSelect: (id: string) => void
  counts?: Record<string, number>
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
              <FoodDetails food={food} count={counts?.[food.id] ?? (counts ? 0 : undefined)} />
            </span>
            {food.status === 'tried' && <Preference value={food.preference} />}
          </button>
        </li>
      ))}
    </ul>
  )
}

function FoodDetails({ food, count }: { food: Food; count?: number }) {
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
        <>
          <span className="text-[13px] text-muted-foreground">
            {count === undefined ? '먹은 횟수 확인 중' : `${count}번 먹음`}
          </span>
          <Detail
            icon={CalendarCheck}
            label="처음 먹은 날"
            value={food.firstTriedDate ? formatDateLabel(food.firstTriedDate) : '모름'}
            known={food.firstTriedDate !== null}
          />
        </>
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

/**
 * 반응 배지 색 (docs/디자인.md 2.4): 매우 좋아함은 메인 보라, 좋아함은 연보라, 보통은 회색, 거부는 연코랄.
 * 연한 색은 배경으로만 쓰고 글자는 진하게 두어 글자 대비(4.5:1)를 지킨다
 */
const PREFERENCE_BADGES: Record<FoodPreference, string> = {
  love: 'bg-primary text-primary-foreground',
  like: 'bg-soft text-soft-text',
  neutral: 'bg-muted text-foreground',
  refuse: 'bg-danger-soft text-danger-text',
}

/** 아이 반응 (FR-FOOD-10, R46). 고르지 않았으면 "미입력" */
function Preference({ value }: { value: FoodPreference | null }) {
  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      <span className="text-xs text-muted-foreground">반응</span>{' '}
      {value ? (
        <Badge className={cn('h-7 px-3 text-[13px]', PREFERENCE_BADGES[value])}>
          {foodPreferenceLabel(value)}
        </Badge>
      ) : (
        <span className="text-[15px] text-muted-foreground">미입력</span>
      )}
    </span>
  )
}
