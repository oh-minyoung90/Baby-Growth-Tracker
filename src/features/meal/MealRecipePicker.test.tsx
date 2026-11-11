import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { MealItem } from '@/lib/mealApi'
import { MealRecipePicker } from './MealRecipePicker'

function Picker({ initial = [] }: { initial?: MealItem[] }) {
  const [selected, setSelected] = useState(initial)
  return (
    <MealRecipePicker
      options={[
        { id: 'r1', name: '채소죽' },
        { id: 'r2', name: '감자전' },
      ]}
      selected={selected}
      onChange={setSelected}
      disabled={false}
    />
  )
}
describe('식단 레시피 선택 UI', () => {
  it('이름으로 검색·선택·제외하고 중복 선택은 막는다', async () => {
    render(<Picker />)
    await userEvent.type(screen.getByRole('searchbox', { name: '식단에 넣을 레시피 검색' }), '채소')
    const results = screen.getByRole('list', { name: '레시피 검색 결과' })
    expect(within(results).queryByText('감자전')).not.toBeInTheDocument()
    await userEvent.click(within(results).getByRole('button', { name: '채소죽' }))
    expect(screen.getByRole('button', { name: '채소죽 빼기' })).toBeInTheDocument()
    expect(
      within(screen.getByRole('list', { name: '레시피 검색 결과' })).getByRole('button', {
        name: '채소죽',
      }),
    ).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: '채소죽 빼기' }))
    expect(screen.queryByRole('list', { name: '선택한 레시피' })).not.toBeInTheDocument()
  })
  it('목록에서 삭제된 레시피도 저장된 이름으로 보여 주고 제외할 수 있다', async () => {
    render(<Picker initial={[{ id: null, name: '예전 레시피' }]} />)
    await userEvent.click(screen.getByRole('button', { name: '예전 레시피 빼기' }))
    expect(screen.queryByRole('list', { name: '선택한 레시피' })).not.toBeInTheDocument()
  })
})
