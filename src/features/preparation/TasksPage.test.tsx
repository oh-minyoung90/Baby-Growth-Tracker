import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { beforeEach, expect, it, vi } from 'vitest'
import { fetchMyChild } from '@/lib/childApi'
import { fetchShoppingItems } from '@/lib/shoppingApi'
import {
  fetchTask,
  fetchTasks,
  saveTask,
  setTaskCompleted,
  deleteTask,
  type PreparationTask,
} from '@/lib/taskApi'
import { renderApp } from '@/test/renderApp'
vi.mock('@/lib/taskApi', () => ({
  fetchTask: vi.fn(),
  fetchTasks: vi.fn(),
  saveTask: vi.fn(),
  setTaskCompleted: vi.fn(),
  deleteTask: vi.fn(),
}))
vi.mock('@/lib/shoppingApi', () => ({ fetchShoppingItems: vi.fn() }))
vi.mock('@/lib/childApi', async (original) => ({
  ...(await original<typeof import('@/lib/childApi')>()),
  fetchMyChild: vi.fn(),
}))
let tasks: PreparationTask[]
const auth = {
  status: 'signedIn' as const,
  session: { user: { id: 'task-test-owner' } } as Session,
}
beforeEach(() => {
  vi.resetAllMocks()
  tasks = [
    {
      id: 't1',
      name: '문화센터 등록',
      memo: '겨울학기 신청',
      dueDate: '2027-01-01',
      url: 'https://example.com/class',
      completed: false,
    },
    { id: 't2', name: '홈 문센 알아보기', memo: null, dueDate: null, url: null, completed: false },
    { id: 't3', name: '도서관 회원증', memo: null, dueDate: null, url: null, completed: true },
  ]
  vi.mocked(fetchMyChild).mockResolvedValue({
    id: 'c1',
    nickname: '가명아기',
    birthDate: '2026-01-08',
  })
  vi.mocked(fetchShoppingItems).mockResolvedValue([])
  vi.mocked(fetchTasks).mockImplementation(async () => tasks.map((task) => ({ ...task })))
  vi.mocked(fetchTask).mockImplementation(
    async (id) => tasks.find((task) => task.id === id) ?? null,
  )
  vi.mocked(setTaskCompleted).mockImplementation(async (id, completed) => {
    const task = tasks.find((task) => task.id === id)!
    task.completed = completed
    return { ...task }
  })
  vi.mocked(saveTask).mockImplementation(async (input, id) => {
    const task = tasks.find((task) => task.id === id)
    if (task) {
      Object.assign(task, input)
      return { ...task }
    }
    const added = { ...input, id: 't4', completed: false }
    tasks.push(added)
    return added
  })
  vi.mocked(deleteTask).mockImplementation(async (id) => {
    tasks = tasks.filter((task) => task.id !== id)
  })
})
it('할 일부터 열리고 구매 목록으로 이동해도 두 종류를 혼합하지 않는다', async () => {
  const { router } = renderApp('/preparation', auth)
  await screen.findByText('할 일 2개')
  const tabs = screen.getByRole('navigation', { name: '준비 목록 종류' })
  expect(
    within(tabs)
      .getAllByRole('link')
      .map((link) => link.textContent),
  ).toEqual(['해야 할 일', '사야 할 물건'])
  expect(screen.getByRole('link', { name: /문화센터 등록/ })).toHaveTextContent('2027. 1. 1.')
  expect(screen.getByRole('link', { name: /관련 링크/ })).toHaveAttribute(
    'rel',
    'noopener noreferrer',
  )
  await userEvent.click(within(tabs).getByRole('link', { name: '사야 할 물건' }))
  await screen.findByText('구매할 물건 0개')
  expect(router.state.location.pathname).toBe('/shopping')
  expect(screen.queryByRole('checkbox', { name: '문화센터 등록 완료' })).not.toBeInTheDocument()
})
it('완료·되돌리기가 목록과 개수에 반영되고 실패한 체크만 재시도한다', async () => {
  vi.mocked(setTaskCompleted).mockRejectedValueOnce(new Error('offline'))
  renderApp('/preparation', auth)
  await userEvent.click(await screen.findByRole('checkbox', { name: '문화센터 등록 완료' }))
  expect(screen.getByRole('checkbox', { name: '문화센터 등록 완료' })).not.toBeChecked()
  await userEvent.click(
    within(await screen.findByRole('alert')).getByRole('button', { name: '다시 시도' }),
  )
  await screen.findByText('할 일 1개')
  await userEvent.click(screen.getByText('완료한 일 2개'))
  await userEvent.click(screen.getByRole('checkbox', { name: '문화센터 등록 완료' }))
  await screen.findByText('할 일 2개')
  expect(setTaskCompleted).toHaveBeenLastCalledWith('t1', false)
})
it('추가 폼은 필수 제목·안전한 링크를 검사하고 선택 마감일 없이 저장한다', async () => {
  const { router } = renderApp('/preparation/tasks/new', auth)
  await userEvent.click(await screen.findByRole('button', { name: '추가하기' }))
  await screen.findByText('해야 할 일을 입력해 주세요')
  await userEvent.type(screen.getByLabelText('해야 할 일'), '  체험 수업 예약  ')
  await userEvent.type(screen.getByLabelText('관련 링크 (선택)'), 'javascript:alert(1)')
  await userEvent.click(screen.getByRole('button', { name: '추가하기' }))
  await screen.findByText(/http:\/\/ 또는 https/)
  expect(saveTask).not.toHaveBeenCalled()
  await userEvent.clear(screen.getByLabelText('관련 링크 (선택)'))
  await userEvent.click(screen.getByRole('button', { name: '추가하기' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/preparation'))
  expect(tasks.at(-1)).toMatchObject({
    name: '체험 수업 예약',
    dueDate: null,
    memo: null,
    url: null,
    completed: false,
  })
})
it('수정 실패 시 입력을 유지하고 마감일을 지우거나 삭제 확인 후 제거할 수 있다', async () => {
  vi.mocked(saveTask).mockRejectedValueOnce(new Error('offline'))
  const { router } = renderApp('/preparation/tasks/t1/edit', auth)
  const name = await screen.findByLabelText('해야 할 일')
  await userEvent.clear(name)
  await userEvent.type(name, '문화센터 상담')
  await userEvent.click(screen.getByRole('button', { name: '마감일 지우기' }))
  await userEvent.click(screen.getByRole('button', { name: '저장' }))
  await screen.findByRole('alert')
  expect(name).toHaveValue('문화센터 상담')
  await userEvent.click(screen.getByRole('button', { name: '저장' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/preparation'))
  expect(tasks[0]).toMatchObject({ dueDate: null, completed: false })
  await userEvent.click(await screen.findByRole('link', { name: /문화센터 상담/ }))
  await userEvent.click(await screen.findByRole('button', { name: '삭제' }))
  const dialog = await screen.findByRole('alertdialog')
  await userEvent.click(within(dialog).getByRole('button', { name: '삭제' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/preparation'))
  expect(tasks.some((task) => task.id === 't1')).toBe(false)
})
it('조회 실패는 빈 목록과 구분하고 다시 불러오며 삭제된 할 일은 수정하지 않는다', async () => {
  vi.mocked(fetchTasks).mockRejectedValueOnce(new Error('offline'))
  renderApp('/preparation', auth)
  const alert = await screen.findByRole('alert')
  expect(screen.queryByText('할 일 0개')).not.toBeInTheDocument()
  await userEvent.click(within(alert).getByRole('button', { name: '다시 시도' }))
  await screen.findByText('할 일 2개')
})
it('삭제된 할 일은 수정하지 않는다', async () => {
  renderApp('/preparation/tasks/missing/edit', auth)
  await screen.findByText('할 일을 찾을 수 없어요. 이미 삭제됐을 수 있어요')
  expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument()
})
