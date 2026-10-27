import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BodyMeasure } from './bodyApi'
import { BodyCharts } from './BodyChart'

// 키·몸무게 차트 (T-17, FR-BODY-03~04, FR-COM-21). 오늘은 2026-10-22, 생년월일은 2026-01-08 (가명 데이터)
const BIRTH = '2026-01-08'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 22, 9, 0))
})
afterEach(() => vi.useRealTimers())

function measure(values: Partial<BodyMeasure> & Pick<BodyMeasure, 'id' | 'date'>): BodyMeasure {
  return { heightCm: null, weightKg: null, memo: null, ...values }
}

/** 목록 순서(최신순)로 넘긴다 */
const MEASURES = [
  measure({ id: 'c', date: '2026-09-30', heightCm: 72.1, weightKg: 8.9 }),
  measure({ id: 'b', date: '2026-05-11', heightCm: 63.8, weightKg: 7.1 }),
  measure({ id: 'a', date: '2026-01-08', heightCm: 50, weightKg: 3.2 }),
]

function chart(name: '키' | '몸무게') {
  return screen.getByRole('region', { name })
}

function dots(region: HTMLElement) {
  return within(region).queryAllByTestId(/^chart-dot/)
}

describe('여러 건', () => {
  it('키 차트와 몸무게 차트를 따로 그리고, 측정마다 점을 찍는다', () => {
    render(<BodyCharts measures={MEASURES} birthDate={BIRTH} />)
    expect(dots(chart('키'))).toHaveLength(3)
    expect(dots(chart('몸무게'))).toHaveLength(3)
  })

  it('처음에는 가장 최근 측정의 날짜·생후 일수·값을 보여 준다', () => {
    render(<BodyCharts measures={MEASURES} birthDate={BIRTH} />)
    expect(chart('키')).toHaveTextContent('2026. 9. 30. (수) · 생후 8개월 22일 · 72.1cm')
    expect(chart('몸무게')).toHaveTextContent('2026. 9. 30. (수) · 생후 8개월 22일 · 8.9kg')
    expect(within(chart('키')).getAllByTestId('chart-dot-selected')).toHaveLength(1)
  })

  it('차트를 누르면 가장 가까운 측정을 고른다', () => {
    render(<BodyCharts measures={MEASURES} birthDate={BIRTH} />)
    // jsdom에서는 차트가 320×160으로 그려진다. 왼쪽 끝(첫 측정) 근처를 누른다
    const surface = chart('키').querySelector('.recharts-wrapper')
    if (!surface) throw new Error('차트가 그려지지 않았습니다')
    fireEvent.mouseMove(surface, { clientX: 52, clientY: 80 })
    fireEvent.click(surface, { clientX: 52, clientY: 80 })
    expect(chart('키')).toHaveTextContent('2026. 1. 8. (목) · 생후 0일 · 50.0cm')
  })
})

describe('기간 선택 (FR-BODY-04)', () => {
  it('기본은 전체이고, 최근 6개월·3개월을 고르면 그 기간의 측정만 그린다', async () => {
    render(<BodyCharts measures={MEASURES} birthDate={BIRTH} />)
    const periods = screen.getByRole('radiogroup', { name: '차트 기간' })
    expect(within(periods).getByRole('radio', { name: '전체' })).toBeChecked()

    await userEvent.click(within(periods).getByRole('radio', { name: '최근 6개월' }))
    expect(within(periods).getByRole('radio', { name: '최근 6개월' })).toBeChecked()
    expect(dots(chart('키'))).toHaveLength(2)

    await userEvent.click(within(periods).getByRole('radio', { name: '최근 3개월' }))
    expect(dots(chart('키'))).toHaveLength(1)
  })

  it('기간 안에 기록이 없으면 차트 대신 안내한다', async () => {
    render(
      <BodyCharts
        measures={[measure({ id: 'a', date: '2026-05-11', heightCm: 63.8 })]}
        birthDate={BIRTH}
      />,
    )
    await userEvent.click(screen.getByRole('radio', { name: '최근 3개월' }))
    expect(chart('키')).toHaveTextContent('이 기간에는 키 기록이 없어요')
    expect(dots(chart('키'))).toHaveLength(0)
  })
})

describe('0건·1건 (FR-COM-21)', () => {
  it('1건이면 점 하나를 그린다', () => {
    render(
      <BodyCharts
        measures={[measure({ id: 'a', date: '2026-09-30', heightCm: 72.1, weightKg: 8.9 })]}
        birthDate={BIRTH}
      />,
    )
    expect(dots(chart('키'))).toHaveLength(1)
    expect(chart('키')).toHaveTextContent('72.1cm')
  })

  it('키만 기록했으면 몸무게 차트는 기록이 없다고 안내한다', () => {
    render(
      <BodyCharts
        measures={[measure({ id: 'a', date: '2026-09-30', heightCm: 72.1 })]}
        birthDate={BIRTH}
      />,
    )
    expect(dots(chart('키'))).toHaveLength(1)
    expect(chart('몸무게')).toHaveTextContent('아직 몸무게 기록이 없어요')
  })
})
