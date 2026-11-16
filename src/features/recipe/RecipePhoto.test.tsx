import { act, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getRecipePhotoUrl } from '@/lib/recipePhotoApi'
import { RecipePhoto } from './RecipePhoto'

vi.mock('@/lib/recipePhotoApi', () => ({ getRecipePhotoUrl: vi.fn() }))
const observers: VisibilityObserver[] = []
class VisibilityObserver {
  callback: IntersectionObserverCallback
  target?: Element
  disconnect = vi.fn()
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    observers.push(this)
  }
  observe(target: Element) {
    this.target = target
  }
  show() {
    this.callback(
      [{ isIntersecting: true, target: this.target } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    )
  }
}
let client: QueryClient
beforeEach(() => {
  observers.length = 0
  vi.clearAllMocks()
  vi.stubGlobal('IntersectionObserver', VisibilityObserver)
  vi.mocked(getRecipePhotoUrl).mockImplementation(async (id) => ({
    url: `https://example.test/${id}.jpg`,
    expiresAt: Date.now() + 3600000,
  }))
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})
afterEach(() => {
  client.clear()
  vi.unstubAllGlobals()
})

it('목록의 보이는 사진만 조회하고 스크롤하면 다음 사진을 불러온다', async () => {
  const view = render(
    <QueryClientProvider client={client}>
      <RecipePhoto id="one" name="쌀죽" lazy />
      <RecipePhoto id="two" name="채소죽" lazy />
    </QueryClientProvider>,
  )
  expect(getRecipePhotoUrl).not.toHaveBeenCalled()
  act(() => observers[0].show())
  expect(await screen.findByRole('img', { name: '쌀죽 사진' })).toHaveAttribute(
    'src',
    'https://example.test/one.jpg',
  )
  expect(getRecipePhotoUrl).toHaveBeenCalledTimes(1)
  expect(getRecipePhotoUrl).not.toHaveBeenCalledWith('two')
  act(() => observers[1].show())
  expect(await screen.findByRole('img', { name: '채소죽 사진' })).toHaveAttribute(
    'src',
    'https://example.test/two.jpg',
  )
  expect(getRecipePhotoUrl).toHaveBeenCalledTimes(2)
  view.unmount()
  expect(observers.every((observer) => observer.disconnect.mock.calls.length > 0)).toBe(true)
})

it('상세 사진은 즉시 조회한다', async () => {
  render(
    <QueryClientProvider client={client}>
      <RecipePhoto id="detail" name="쌀죽" />
    </QueryClientProvider>,
  )
  expect(await screen.findByRole('img', { name: '쌀죽 사진' })).toBeVisible()
  expect(getRecipePhotoUrl).toHaveBeenCalledWith('detail')
  expect(observers).toHaveLength(0)
})

it('IntersectionObserver를 지원하지 않아도 사진을 조회한다', async () => {
  vi.stubGlobal('IntersectionObserver', undefined)
  render(
    <QueryClientProvider client={client}>
      <RecipePhoto id="fallback" name="쌀죽" lazy />
    </QueryClientProvider>,
  )
  await waitFor(() =>
    expect(screen.getByRole('img', { name: '쌀죽 사진' })).toHaveAttribute(
      'src',
      'https://example.test/fallback.jpg',
    ),
  )
})
