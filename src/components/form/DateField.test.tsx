import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { todayString } from '@/domain/date'
import { DATE_MESSAGES, recordDate } from '@/lib/validation'
import { DateField } from './DateField'

// 날짜 입력 (FR-COM-01~05). 테스트의 오늘은 2026-10-22(목), 생년월일은 가명 데이터

const BIRTH = '2026-01-08'
const schema = z.object({ date: recordDate({ birthDate: BIRTH }) })

function TestForm({ onSubmit }: { onSubmit: (values: z.output<typeof schema>) => void }) {
  const { control, handleSubmit } = useForm<
    z.input<typeof schema>,
    unknown,
    z.output<typeof schema>
  >(
    // 기록 날짜의 기본값은 오늘 (FR-COM-02)
    { resolver: zodResolver(schema), defaultValues: { date: todayString() } },
  )
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <DateField control={control} name="date" label="날짜" min={BIRTH} max={todayString()} />
      <button type="submit">저장</button>
    </form>
  )
}

function dateInput() {
  return screen.getByLabelText('날짜')
}

/** 날짜 입력칸은 브라우저마다 입력 방식이 달라 값을 바로 넣는다 */
function setDate(value: string) {
  fireEvent.change(dateInput(), { target: { value } })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 22, 9, 0))
})
afterEach(() => vi.useRealTimers())

describe('DateField', () => {
  it('기본값 오늘을 요일과 함께 보여 준다', () => {
    render(<TestForm onSubmit={vi.fn()} />)
    expect(dateInput()).toHaveValue('2026-10-22')
    expect(screen.getByText('2026. 10. 22. (목)')).toBeInTheDocument()
  })

  it('달력에서 고를 수 있는 범위를 생년월일~오늘로 제한한다', () => {
    render(<TestForm onSubmit={vi.fn()} />)
    expect(dateInput()).toHaveAttribute('min', BIRTH)
    expect(dateInput()).toHaveAttribute('max', '2026-10-22')
  })

  it('과거 날짜를 고르면 표시가 바뀌고 그 값으로 저장한다', async () => {
    const onSubmit = vi.fn()
    render(<TestForm onSubmit={onSubmit} />)
    setDate('2026-09-03')
    expect(screen.getByText('2026. 9. 3. (목)')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(onSubmit).toHaveBeenCalledWith({ date: '2026-09-03' }, expect.anything())
  })

  it('날짜를 지우면 선택하라고 표시한다', () => {
    render(<TestForm onSubmit={vi.fn()} />)
    setDate('')
    expect(screen.getByText('날짜를 선택해 주세요')).toBeInTheDocument()
  })

  it.each([
    ['2026-10-23', DATE_MESSAGES.future],
    ['2026-01-07', DATE_MESSAGES.beforeBirth],
  ])('범위 밖 날짜(%s)는 저장하지 않고 입력칸 아래에 안내한다', async (value, message) => {
    const onSubmit = vi.fn()
    render(<TestForm onSubmit={onSubmit} />)
    setDate(value)
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(dateInput()).toHaveAttribute('aria-invalid', 'true')
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
