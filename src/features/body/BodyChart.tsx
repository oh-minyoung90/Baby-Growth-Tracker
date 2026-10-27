import { useId, useState } from 'react'
import { format } from 'date-fns'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type DotItemDotProps,
} from 'recharts'
import { ChoiceChips } from '@/components/ChoiceChips'
import { ageLabel } from '@/domain/age'
import { formatDateLabel, todayString } from '@/domain/date'
import type { BodyMeasure } from './bodyApi'
import {
  CHART_PERIODS,
  chartPoints,
  periodStart,
  timeDomain,
  timeTicks,
  valueDomain,
  type ChartPeriod,
  type ChartPoint,
} from './bodyChartData'
import { formatMeasureValue } from './bodyFormat'

const AXIS_TICK = { fill: 'var(--color-muted-foreground)', fontSize: 11 }

/** 기간 선택 + 키 차트·몸무게 차트 (FR-BODY-03~04). 기본 기간은 전체. PC에서는 두 차트를 나란히 둔다 */
export function BodyCharts({
  measures,
  birthDate,
}: {
  measures: BodyMeasure[]
  birthDate: string | undefined
}) {
  const [period, setPeriod] = useState<ChartPeriod>('all')
  const start = periodStart(period, todayString())
  const emptyMessage = (name: string) =>
    period === 'all' ? `아직 ${name} 기록이 없어요` : `이 기간에는 ${name} 기록이 없어요`

  return (
    <section aria-label="성장 차트" className="flex flex-col gap-3">
      <ChoiceChips label="차트 기간" options={CHART_PERIODS} value={period} onChange={setPeriod} />
      <div className="grid gap-3 md:grid-cols-2 md:gap-5">
        <BodyChart
          title="키"
          unit="cm"
          points={chartPoints(measures, 'heightCm', start)}
          birthDate={birthDate}
          emptyMessage={emptyMessage('키')}
        />
        <BodyChart
          title="몸무게"
          unit="kg"
          points={chartPoints(measures, 'weightKg', start)}
          birthDate={birthDate}
          emptyMessage={emptyMessage('몸무게')}
        />
      </div>
    </section>
  )
}

/**
 * 키 또는 몸무게 차트 하나 (FR-BODY-03, FR-COM-21). 가로축은 측정 날짜, 세로축은 값.
 * 차트를 누르면 가장 가까운 측정을 골라 날짜·생후 일수·값을 제목 옆에 보여 준다. 처음에는 가장 최근 측정.
 * 차트 그림은 화면 낭독기에서 숨긴다. 같은 값은 아래 측정 목록에서 읽을 수 있다.
 */
export function BodyChart({
  title,
  unit,
  points,
  birthDate,
  emptyMessage,
}: {
  title: string
  unit: string
  /** 날짜 오래된 순 (bodyChartData.ts의 chartPoints) */
  points: ChartPoint[]
  birthDate: string | undefined
  /** 그릴 점이 없을 때 안내 */
  emptyMessage: string
}) {
  const titleId = useId()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // 고른 점이 기간을 바꿔 빠졌으면 가장 최근 측정을 보여 준다
  const selected = points.find((point) => point.id === selectedId) ?? points.at(-1)

  return (
    <section
      aria-labelledby={titleId}
      className="flex min-w-0 flex-col gap-2 rounded-card border bg-surface p-4 md:p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h3 id={titleId} className="text-base font-bold md:text-[17px]">
          {title}
        </h3>
        {selected && (
          <p aria-live="polite" className="text-[13px] text-muted-foreground">
            {[
              formatDateLabel(selected.date),
              ageLabel(birthDate, selected.date),
              formatMeasureValue(selected.value, unit),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
      </div>

      {points.length === 0 ? (
        <p className="flex h-40 items-center justify-center text-sm text-muted-foreground md:h-50">
          {emptyMessage}
        </p>
      ) : (
        // Recharts가 그림 묶음에 tabindex="-1"을 붙여, 누르면 초점 테두리가 생긴다. 키보드로 쓰는 차트가 아니라 숨긴다
        <div aria-hidden className="h-40 cursor-pointer md:h-50 [&_*]:outline-none">
          {/* 테스트 환경(jsdom)처럼 크기를 잴 수 없으면 initialDimension 크기로 그린다 */}
          <ResponsiveContainer initialDimension={{ width: 320, height: 160 }}>
            <LineChart
              data={points}
              margin={{ top: 8, right: 18, bottom: 0, left: 0 }}
              accessibilityLayer={false}
              onClick={(state) => {
                const point = points[Number(state.activeTooltipIndex)]
                if (point) setSelectedId(point.id)
              }}
            >
              <CartesianGrid vertical={false} stroke="var(--color-line)" />
              <XAxis
                dataKey="time"
                type="number"
                scale="time"
                domain={timeDomain(points)}
                ticks={timeTicks(points)}
                tickFormatter={(time: number) => format(time, 'M. d.')}
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={valueDomain(points)}
                ticks={valueDomain(points)}
                tickFormatter={(value: number) => `${value}${unit}`}
                tick={AXIS_TICK}
                width={48}
                axisLine={false}
                tickLine={false}
              />
              {/* 말풍선은 띄우지 않고, 누른 위치에서 가장 가까운 점을 찾는 데만 쓴다 */}
              <Tooltip content={() => null} cursor={{ stroke: 'var(--color-line)' }} />
              <Line
                dataKey="value"
                type="linear"
                stroke="var(--color-primary)"
                strokeWidth={2.5}
                isAnimationActive={false}
                activeDot={false}
                dot={(props: DotItemDotProps) => (
                  <ChartDot
                    key={props.index}
                    cx={props.cx}
                    cy={props.cy}
                    selected={points[props.index]?.id === selected?.id}
                  />
                )}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}

/** 측정 점. 고른 점은 크게 채워 표시한다 */
function ChartDot({ cx, cy, selected }: { cx?: number; cy?: number; selected: boolean }) {
  if (cx === undefined || cy === undefined) return null
  return (
    <circle
      data-testid={selected ? 'chart-dot-selected' : 'chart-dot'}
      cx={cx}
      cy={cy}
      r={selected ? 6 : 4}
      fill={selected ? 'var(--color-primary)' : 'var(--color-surface)'}
      stroke="var(--color-primary)"
      strokeWidth={2}
    />
  )
}
