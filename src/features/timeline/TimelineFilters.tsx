import { ChoiceChips } from '@/components/ChoiceChips'
import { DateInput } from '@/components/form/DateField'
import { Field } from '@/components/form/Field'
import { invalidProps } from '@/components/form/invalidProps'
import { todayString } from '@/domain/date'
import {
  RANGE_ERROR,
  TIMELINE_PERIODS,
  TIMELINE_TYPE_VALUES,
  isInvalidRange,
  timelineTypeInfo,
  type TimelineFilter,
  type TimelinePeriod,
} from './timeline'

/**
 * 유형·기간 필터 (FR-TL-03~04).
 * 모바일은 목록 위에 칩 두 줄, PC는 왼쪽 필터 상자에 "유형"·"기간" 제목과 함께 둔다.
 * 선택 상태는 모두 보라색 (docs/디자인.md 2.4)
 */
export function TimelineFilters({
  filter,
  onChange,
  birthDate,
}: {
  filter: TimelineFilter
  onChange: (filter: TimelineFilter) => void
  birthDate: string | undefined
}) {
  const today = todayString()

  const toggleType = (type: (typeof TIMELINE_TYPE_VALUES)[number]) =>
    onChange({
      ...filter,
      types: filter.types.includes(type)
        ? filter.types.filter((value) => value !== type)
        : [...filter.types, type],
    })

  const changePeriod = (period: TimelinePeriod) =>
    onChange(
      // 직접 선택을 처음 고르면 이번 달 1일~오늘로 시작한다
      period === 'custom' && !filter.from && !filter.to
        ? { ...filter, period, from: `${today.slice(0, 7)}-01`, to: today }
        : { ...filter, period },
    )

  return (
    <aside
      aria-label="필터"
      className="flex flex-col gap-3 lg:w-60 lg:shrink-0 lg:gap-5 lg:rounded-card lg:border lg:bg-surface lg:p-5"
    >
      <div className="flex flex-col gap-2">
        <p aria-hidden className="hidden text-sm font-bold lg:block">
          유형
        </p>
        <div role="group" aria-label="유형" className="flex flex-wrap gap-2">
          {TIMELINE_TYPE_VALUES.map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={filter.types.includes(type)}
              onClick={() => toggleType(type)}
              className="relative h-9 rounded-full border border-line bg-surface px-4 text-sm font-medium text-muted-foreground transition-colors after:absolute after:inset-x-0 after:-inset-y-1 aria-pressed:border-2 aria-pressed:border-primary aria-pressed:bg-soft aria-pressed:px-[15px] aria-pressed:font-bold aria-pressed:text-soft-text"
            >
              {timelineTypeInfo(type).label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p aria-hidden className="hidden text-sm font-bold lg:block">
          기간
        </p>
        <ChoiceChips
          label="기간"
          options={TIMELINE_PERIODS}
          value={filter.period}
          onChange={changePeriod}
        />
        {filter.period === 'custom' && (
          <CustomRange filter={filter} onChange={onChange} birthDate={birthDate} today={today} />
        )}
      </div>
    </aside>
  )
}

/** 직접 선택: 시작일~종료일 (양 끝 포함). 달력에서는 생년월일~오늘 사이만 고를 수 있다 */
function CustomRange({
  filter,
  onChange,
  birthDate,
  today,
}: {
  filter: TimelineFilter
  onChange: (filter: TimelineFilter) => void
  birthDate: string | undefined
  today: string
}) {
  const error = isInvalidRange(filter) ? RANGE_ERROR : undefined
  return (
    <div className="mt-1 flex flex-col gap-3">
      <Field id="tl-from" label="시작일">
        <DateInput
          id="tl-from"
          value={filter.from}
          min={birthDate}
          max={filter.to || today}
          onChange={(event) => onChange({ ...filter, from: event.target.value })}
        />
      </Field>
      <Field id="tl-to" label="종료일" error={error}>
        <DateInput
          id="tl-to"
          value={filter.to}
          min={filter.from || birthDate}
          max={today}
          onChange={(event) => onChange({ ...filter, to: event.target.value })}
          {...invalidProps('tl-to', error)}
        />
      </Field>
    </div>
  )
}
