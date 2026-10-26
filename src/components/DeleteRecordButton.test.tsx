import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DeleteRecordButton } from './DeleteRecordButton'

// 수정 화면의 삭제 버튼과 삭제 확인 창 (FR-COM-31, 기능요구사항서 3.4)

describe('DeleteRecordButton', () => {
  it('누르면 앱 자체 확인 창을 띄운다 (왼쪽 취소, 오른쪽 삭제)', async () => {
    render(<DeleteRecordButton onConfirm={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: '삭제' }))
    const dialog = screen.getByRole('alertdialog', { name: '이 기록을 삭제할까요?' })
    expect(dialog).toHaveAccessibleDescription('삭제하면 되돌릴 수 없어요')
    const buttons = within(dialog).getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual(['취소', '삭제'])
  })

  it('취소하면 삭제하지 않는다', async () => {
    const onConfirm = vi.fn()
    render(<DeleteRecordButton onConfirm={onConfirm} />)
    await userEvent.click(screen.getByRole('button', { name: '삭제' }))
    await userEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('삭제를 확인하면 창을 닫고 삭제한다', async () => {
    const onConfirm = vi.fn()
    render(<DeleteRecordButton onConfirm={onConfirm} />)
    await userEvent.click(screen.getByRole('button', { name: '삭제' }))
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: '삭제' }),
    )
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('삭제 중에는 다시 누를 수 없다', () => {
    render(<DeleteRecordButton onConfirm={vi.fn()} pending />)
    expect(screen.getByRole('button', { name: '삭제하는 중…' })).toBeDisabled()
  })
})
