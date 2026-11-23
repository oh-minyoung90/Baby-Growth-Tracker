import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import { fetchMyChild } from '@/lib/childApi'
import {
  fetchShoppingItems,
  fetchShoppingItem,
  saveShoppingItem,
  setShoppingStatus,
  deleteShoppingItem,
  type ShoppingItem,
} from '@/lib/shoppingApi'
import { renderApp } from '@/test/renderApp'
import { shoppingNavKey } from '@/lib/shoppingNavigation'
vi.mock('@/lib/shoppingApi', () => ({
  fetchShoppingItems: vi.fn(),
  fetchShoppingItem: vi.fn(),
  saveShoppingItem: vi.fn(),
  setShoppingStatus: vi.fn(),
  deleteShoppingItem: vi.fn(),
}))
vi.mock('@/lib/childApi', async (original) => ({
  ...(await original<typeof import('@/lib/childApi')>()),
  fetchMyChild: vi.fn(),
}))
beforeAll(() =>
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  ),
)
afterAll(() => vi.unstubAllGlobals())
const auth = {
  status: 'signedIn' as const,
  session: { user: { id: 'shopping-test-user' } } as Session,
}
let items: ShoppingItem[]
beforeEach(() => {
  vi.resetAllMocks()
  localStorage.removeItem(shoppingNavKey(auth.session.user.id))
  items = [
    {
      id: 's1',
      name: '요거트',
      category: 'food',
      url: 'https://example.com/yogurt',
      memo: null,
      frequent: true,
      status: 'pending',
    },
    {
      id: 's2',
      name: '그림책',
      category: 'books',
      url: null,
      memo: '보드북',
      frequent: true,
      status: 'saved',
    },
    {
      id: 's3',
      name: '블록',
      category: 'toys',
      url: null,
      memo: null,
      frequent: false,
      status: 'purchased',
    },
  ]
  vi.mocked(fetchMyChild).mockResolvedValue({
    id: 'c1',
    nickname: '가명아기',
    birthDate: '2026-01-08',
  })
  vi.mocked(fetchShoppingItems).mockImplementation(async () => [...items])
  vi.mocked(fetchShoppingItem).mockImplementation(
    async (id) => items.find((i) => i.id === id) ?? null,
  )
  vi.mocked(setShoppingStatus).mockImplementation(async (id, status) => {
    const i = items.find((i) => i.id === id)!
    i.status = status
    return { ...i }
  })
  vi.mocked(saveShoppingItem).mockImplementation(async (input, id, saved) => {
    const i = items.find((i) => i.id === id)
    if (i) {
      Object.assign(i, input)
      return { ...i }
    }
    const added = { ...input, id: 's4', status: saved ? ('saved' as const) : ('pending' as const) }
    items.push(added)
    return added
  })
  vi.mocked(deleteShoppingItem).mockImplementation(async (id) => {
    items = items.filter((i) => i.id !== id)
  })
})
async function open(path = '/shopping') {
  const result = renderApp(path, auth)
  await screen.findByRole('heading', {
    name: path.includes('/new')
      ? '물건 추가'
      : path.includes('/edit')
        ? '물건 수정'
        : path === '/settings'
          ? '설정'
          : '사야 할 물건',
  })
  return result
}
it('구매 체크·완료 되돌리기 후에도 구매 링크를 보존한다', async () => {
  await open()
  await userEvent.click(await screen.findByRole('checkbox', { name: '요거트 구매 완료' }))
  await waitFor(() => expect(setShoppingStatus).toHaveBeenCalledWith('s1', 'purchased'))
  await userEvent.click(screen.getByText('구매 완료 2개'))
  await userEvent.click(await screen.findByRole('checkbox', { name: '요거트 구매 완료' }))
  await waitFor(() => expect(setShoppingStatus).toHaveBeenLastCalledWith('s1', 'pending'))
  expect(items[0].url).toBe('https://example.com/yogurt')
})
it('카테고리·탭은 주소에 유지하고 보관한 물건을 중복 없이 다시 담는다', async () => {
  const { router } = await open('/shopping?tab=frequent&category=books')
  await userEvent.click(await screen.findByRole('button', { name: '다시 담기' }))
  expect(await screen.findByRole('button', { name: '목록에 있음' })).toBeDisabled()
  expect(router.state.location.search).toBe('?tab=frequent&category=books')
  expect(items.filter((i) => i.id === 's2')).toHaveLength(1)
  await userEvent.click(
    within(screen.getByRole('radiogroup', { name: '카테고리' })).getByRole('radio', {
      name: '장난감',
    }),
  )
  expect(await screen.findByText('이 카테고리에 등록된 물건이 없어요')).toBeVisible()
})
it('조회·체크 실패를 안내하고 체크 재시도는 같은 항목에 적용한다', async () => {
  vi.mocked(setShoppingStatus).mockRejectedValueOnce(new Error('offline'))
  await open()
  await userEvent.click(await screen.findByRole('checkbox', { name: '요거트 구매 완료' }))
  await userEvent.click(
    within(await screen.findByRole('alert')).getByRole('button', { name: '다시 시도' }),
  )
  await waitFor(() => expect(setShoppingStatus).toHaveBeenCalledTimes(2))
  expect(setShoppingStatus).toHaveBeenLastCalledWith('s1', 'purchased')
})
it('새 보관 물건은 구매 목록에 넣지 않고 입력 오류·URL을 검증한다', async () => {
  const { router } = await open('/shopping/new?frequent=1')
  await userEvent.click(screen.getByRole('button', { name: '추가하기' }))
  expect(await screen.findByText('물건 이름을 입력해 주세요')).toBeVisible()
  await userEvent.type(screen.getByLabelText('물건 이름'), '아기 칫솔')
  await userEvent.type(screen.getByLabelText('구매 링크 (선택)'), 'javascript:alert(1)')
  await userEvent.click(screen.getByRole('button', { name: '추가하기' }))
  expect(await screen.findByText(/http:\/\/ 또는 https/)).toBeVisible()
  await userEvent.clear(screen.getByLabelText('구매 링크 (선택)'))
  await userEvent.type(screen.getByLabelText('구매 링크 (선택)'), 'https://example.com/brush')
  await userEvent.click(screen.getByRole('button', { name: '추가하기' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/shopping'))
  expect(items.at(-1)).toMatchObject({
    name: '아기 칫솔',
    frequent: true,
    status: 'saved',
    url: 'https://example.com/brush',
  })
})
it('수정 저장 오류에도 입력을 유지하며 재저장·삭제 확인이 동작한다', async () => {
  vi.mocked(saveShoppingItem).mockRejectedValueOnce(new Error('offline'))
  const { router } = await open('/shopping/s1/edit')
  const name = await screen.findByLabelText('물건 이름')
  await userEvent.clear(name)
  await userEvent.type(name, '플레인 요거트')
  await userEvent.click(screen.getByRole('button', { name: '저장' }))
  await screen.findByRole('alert')
  expect(name).toHaveValue('플레인 요거트')
  await userEvent.click(screen.getByRole('button', { name: '저장' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/shopping'))
  await userEvent.click(await screen.findByRole('link', { name: /플레인 요거트/ }))
  await userEvent.click(await screen.findByRole('button', { name: '삭제' }))
  const dialog = await screen.findByRole('alertdialog')
  await userEvent.click(within(dialog).getByRole('button', { name: '삭제' }))
  await waitFor(() => expect(deleteShoppingItem).toHaveBeenCalledWith('s1'))
})
it('하단 탭 설정은 설정 접근을 유지하고 이 브라우저의 해당 계정에만 저장한다', async () => {
  await open('/settings')
  await userEvent.click(screen.getByRole('switch', { name: '하단 메뉴에 쇼핑 표시' }))
  const nav = screen.getAllByRole('navigation', { name: '주 메뉴' })[1]
  expect(within(nav).getAllByRole('link')).toHaveLength(5)
  expect(within(nav).getByRole('link', { name: '쇼핑' })).toBeInTheDocument()
  expect(within(nav).queryByRole('link', { name: '설정' })).not.toBeInTheDocument()
  expect(localStorage.getItem(shoppingNavKey(auth.session.user.id))).toBe('true')
  expect(screen.getAllByRole('link', { name: '설정' }).length).toBeGreaterThan(0)
  await userEvent.click(screen.getByRole('switch', { name: '하단 메뉴에 쇼핑 표시' }))
  expect(within(nav).getByRole('link', { name: '설정' })).toBeInTheDocument()
})
