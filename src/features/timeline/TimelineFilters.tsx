import { ChoiceChips } from '@/components/ChoiceChips'
import { DateInput } from '@/components/form/DateField'
import { Field } from '@/components/form/Field'
import { invalidProps } from '@/components/form/invalidProps'
import { todayString } from '@/domain/date'
import {
  RANGE_ERROR,
  TIMELINE_PERIODS,
  isInvalidRange,
  type TimelineFilter,
  type TimelinePeriod,
} from './timeline'

/**
 * 기간 필터 (FR-TL-04). 유형 선택은 위쪽 누적 카드에서만 한다.
 * 모바일·PC 모두 기록 목록 위에 둔다.
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

  const changePeriod = (period: TimelinePeriod) =>
    onChange(
      // 직접 선택을 처음 고르면 이번 달 1일~오늘로 시작한다
      period === 'custom' && !filter.from && !filter.to
        ? { ...filter, period, from: `${today.slice(0, 7)}-01`, to: today }
        : { ...filter, period },
    )

  return (
    <aside aria-label="기간 필터" className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
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
    <div className="mt-1 grid max-w-120 gap-3 sm:grid-cols-2">
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
