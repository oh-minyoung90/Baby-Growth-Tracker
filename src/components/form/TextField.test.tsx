import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { optionalText, requiredText } from '@/lib/validation'
import { TextField } from './TextField'

// 글자 수 제한 입력칸 (FR-COM-10~12)

const schema = z.object({
  title: requiredText(30, '내용을 입력해 주세요'),
  memo: optionalText(500),
})

function TestForm({
  onSubmit,
  defaultValues = { title: '', memo: '' },
}: {
  onSubmit: (values: z.output<typeof schema>) => void
  defaultValues?: z.input<typeof schema>
}) {
  const { control, handleSubmit } = useForm<
    z.input<typeof schema>,
    unknown,
    z.output<typeof schema>
  >({ resolver: zodResolver(schema), defaultValues })
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <TextField control={control} name="title" label="내용" maxLength={30} />
      <TextField control={control} name="memo" label="메모" maxLength={500} multiline />
      <button type="submit">저장</button>
    </form>
  )
}

describe('TextField', () => {
  it('라벨 오른쪽에 글자 수를 표시하고, 입력하면 바뀐다', async () => {
    render(<TestForm onSubmit={vi.fn()} defaultValues={{ title: '잡고 서기', memo: '' }} />)
    expect(screen.getByText('5 / 30')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('내용'), '!')
    expect(screen.getByText('6 / 30')).toBeInTheDocument()
  })

  it('제한에 도달하면 더 입력되지 않는다', async () => {
    render(<TestForm onSubmit={vi.fn()} />)
    const input = screen.getByLabelText('내용')
    expect(input).toHaveAttribute('maxLength', '30')
    await userEvent.type(input, '가'.repeat(35))
    expect(input).toHaveValue('가'.repeat(30))
    expect(screen.getByText('30 / 30')).toBeInTheDocument()
  })

  it('메모는 여러 줄 입력칸이다', () => {
    render(<TestForm onSubmit={vi.fn()} />)
    expect(screen.getByLabelText('메모').tagName).toBe('TEXTAREA')
    expect(screen.getByText('0 / 500')).toBeInTheDocument()
  })

  it('필수값이 비어 있으면 입력칸 아래에 안내하고 저장하지 않는다', async () => {
    const onSubmit = vi.fn()
    render(<TestForm onSubmit={onSubmit} />)
    await userEvent.type(screen.getByLabelText('내용'), '   ')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    const input = screen.getByLabelText('내용')
    const error = await screen.findByRole('alert')
    expect(error).toHaveTextContent('내용을 입력해 주세요')
    // 오류 문구를 입력칸과 연결해 화면 낭독기가 함께 읽게 한다
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('내용을 입력해 주세요')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('저장할 때 앞뒤 공백을 지우고, 빈 메모는 null로 넘긴다', async () => {
    const onSubmit = vi.fn()
    render(<TestForm onSubmit={onSubmit} />)
    await userEvent.type(screen.getByLabelText('내용'), '  첫 걸음 ')
    await userEvent.type(screen.getByLabelText('메모'), '   ')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(onSubmit).toHaveBeenCalledWith({ title: '첫 걸음', memo: null }, expect.anything())
  })
})
