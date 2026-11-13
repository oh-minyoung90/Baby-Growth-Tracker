import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchMyChild } from '@/lib/childApi'
import { fetchFoods, type Food } from '@/lib/foodApi'
import { fetchRecipe, fetchRecipes, saveRecipe, type Recipe } from '@/lib/recipeApi'
import { deleteRecipePhoto, getRecipePhotoUrl } from '@/lib/recipePhotoApi'
import { renderApp } from '@/test/renderApp'
vi.mock('@/lib/childApi', () => ({ fetchMyChild: vi.fn() }))
vi.mock('@/lib/foodApi', async (original) => ({
  ...(await original<typeof import('@/lib/foodApi')>()),
  fetchFoods: vi.fn(),
}))
vi.mock('@/lib/recipeApi', async (original) => ({
  ...(await original<typeof import('@/lib/recipeApi')>()),
  fetchRecipe: vi.fn(),
  fetchRecipes: vi.fn(),
  saveRecipe: vi.fn(),
  deleteRecipe: vi.fn(),
}))
vi.mock('@/lib/recipePhotoApi', () => ({
  getRecipePhotoUrl: vi.fn(),
  uploadRecipePhoto: vi.fn(),
  deleteRecipePhoto: vi.fn(),
  cleanupPendingRecipePhoto: vi.fn(),
}))
const auth = { status: 'signedIn' as const, session: { user: { id: 'u1' } } as Session }
const foods = [
  { id: 'f1', name: '쌀', status: 'not_tried', cautionTag: false },
  { id: 'f2', name: '달걀', status: 'caution', cautionTag: false },
] as Food[]
const recipes: Recipe[] = [
  {
    id: 'r1',
    name: '달걀죽',
    servings: '2회분',
    note: '뜨거워요',
    photoId: null,
    ingredients: [
      { foodId: 'f1', name: '쌀', amount: '30g' },
      { foodId: 'f2', name: '달걀', amount: '1개' },
    ],
    steps: ['쌀을 씻어요', '끓여요'],
  },
  {
    id: 'r2',
    name: '쌀죽',
    servings: null,
    note: null,
    photoId: null,
    ingredients: [{ foodId: 'f1', name: '쌀', amount: null }],
    steps: ['끓여요'],
  },
]
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(fetchMyChild).mockResolvedValue({
    id: 'c1',
    nickname: '하늘이',
    birthDate: '2026-01-08',
  })
  vi.mocked(fetchFoods).mockResolvedValue(foods)
  vi.mocked(fetchRecipes).mockResolvedValue(recipes)
  vi.mocked(fetchRecipe).mockImplementation(async (id) => recipes.find((r) => r.id === id) ?? null)
})
describe('레시피 목록·상세·편집', () => {
  it('이름 검색과 AND 재료 필터로 좁히고 해제한다', async () => {
    const user = userEvent.setup()
    renderApp('/meals/recipes', auth)
    await screen.findByRole('heading', { name: '달걀죽' })
    await user.click(screen.getByRole('button', { name: '재료 필터' }))
    const filter = screen.getByRole('region', { name: '재료 필터' })
    await user.click(within(filter).getByRole('button', { name: '쌀' }))
    await user.click(within(filter).getByRole('button', { name: '달걀' }))
    expect(screen.queryByRole('heading', { name: '쌀죽' })).not.toBeInTheDocument()
    expect(screen.getByText('주의: 달걀')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '재료 필터 초기화' }))
    expect(screen.getByRole('heading', { name: '쌀죽' })).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: '레시피 이름 검색' }), '없는 이름')
    expect(screen.getByText('조건에 맞는 레시피가 없어요')).toBeInTheDocument()
  })
  it('빈 목록에서 등록 화면을 열고 하단 탭을 숨긴다', async () => {
    vi.mocked(fetchRecipes).mockResolvedValue([])
    const user = userEvent.setup()
    const { router } = renderApp('/meals/recipes', auth)
    await screen.findByText('등록된 레시피가 없어요')
    await user.click(screen.getByRole('link', { name: '레시피 추가' }))
    await screen.findByRole('heading', { name: '레시피 등록' })
    expect(router.state.location.pathname).toBe('/meals/recipes/new')
    expect(screen.getAllByRole('navigation', { name: '주 메뉴' })).toHaveLength(1)
  })
  it('상세에서 재료 양·주의·번호 순서·참고를 보여준다', async () => {
    renderApp('/meals/recipes/r1', auth)
    await screen.findByRole('heading', { name: '달걀죽' })
    expect(screen.getByText('30g')).toBeInTheDocument()
    expect(screen.getByText('주의')).toBeInTheDocument()
    expect(screen.getByText('쌀을 씻어요')).toBeInTheDocument()
    expect(screen.getByText('뜨거워요')).toBeInTheDocument()
  })
  it('없는 상세는 접근 불가 안내를 보여준다', async () => {
    renderApp('/meals/recipes/missing', auth)
    expect(await screen.findByRole('alert')).toHaveTextContent('레시피를 찾을 수 없어요')
  })
  it('공백 이름·재료·조리 단계를 저장하지 않는다', async () => {
    const user = userEvent.setup()
    renderApp('/meals/recipes/new', auth)
    await screen.findByRole('heading', { name: '레시피 등록' })
    await user.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByText('레시피 이름을 입력해 주세요')).toBeInTheDocument()
    expect(screen.getByText('재료를 하나 이상 입력해 주세요')).toBeInTheDocument()
    expect(screen.getByText('조리 순서를 하나 이상 입력해 주세요')).toBeInTheDocument()
    expect(saveRecipe).not.toHaveBeenCalled()
  })
  it('여러 줄 재료·조리 순서를 저장하고 실패해도 유지한 같은 ID로 재시도한다', async () => {
    const user = userEvent.setup()
    renderApp('/meals/recipes/new', auth)
    await screen.findByRole('heading', { name: '레시피 등록' })
    await user.type(screen.getByLabelText('레시피 이름'), '물죽')
    await user.type(screen.getByLabelText('재료'), '물 100ml')
    await user.type(screen.getByLabelText('조리 순서'), '다음{enter}{enter}먼저')
    expect(
      within(screen.getByRole('list', { name: '조리 순서 미리보기' })).getAllByRole('listitem'),
    ).toHaveLength(2)
    vi.mocked(saveRecipe).mockRejectedValueOnce(new Error('network'))
    await user.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('입력값은 유지')
    expect(screen.getByLabelText('레시피 이름')).toHaveValue('물죽')
    await user.click(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(saveRecipe).toHaveBeenCalledTimes(2))
    expect(vi.mocked(saveRecipe).mock.calls[0][0]).toBe(vi.mocked(saveRecipe).mock.calls[1][0])
    expect(vi.mocked(saveRecipe).mock.calls[1][1]).toMatchObject({
      name: '물죽',
      ingredients: [{ foodId: null, name: '물', amount: '100ml' }],
      steps: ['다음', '먼저'],
    })
  })
  it('음식 검색 결과를 고른 재료는 ID를 연결하고 이름 수정 시 해제한다', async () => {
    const user = userEvent.setup()
    renderApp('/meals/recipes/new', auth)
    await screen.findByRole('heading', { name: '레시피 등록' })
    await user.type(screen.getByLabelText('레시피 이름'), '검증 죽')
    await user.type(screen.getByLabelText('재료'), '달걀 1개')
    await user.click(screen.getByRole('button', { name: '재료 1 음식 연결' }))
    await user.click(screen.getByRole('button', { name: /달걀.*주의/ }))
    expect(screen.getByRole('button', { name: '재료 1 연결 해제' })).toBeInTheDocument()
    await user.clear(screen.getByLabelText('재료'))
    await user.type(screen.getByLabelText('재료'), '물 100ml')
    expect(screen.queryByRole('button', { name: '재료 1 연결 해제' })).not.toBeInTheDocument()
  })
  it('상세에서 목록으로 돌아와도 검색과 선택 재료를 유지한다', async () => {
    const user = userEvent.setup()
    renderApp('/meals/recipes?q=달걀&ingredients=f1,f2', auth)
    await screen.findByRole('heading', { name: '달걀죽' })
    await user.click(screen.getByRole('link', { name: /달걀죽/ }))
    await screen.findByRole('heading', { name: '조리 순서' })
    await user.click(screen.getByRole('button', { name: '레시피 목록으로' }))
    expect(await screen.findByRole('textbox', { name: '레시피 이름 검색' })).toHaveValue('달걀')
    expect(screen.getByRole('button', { name: '쌀' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '달걀' })).toHaveAttribute('aria-pressed', 'true')
  })
  it('사진 연결 해제 저장 후 정리 실패는 입력을 잠그고 정리만 재시도한다', async () => {
    const user = userEvent.setup()
    vi.mocked(fetchRecipe).mockResolvedValue({ ...recipes[0], photoId: 'old-photo' })
    vi.mocked(getRecipePhotoUrl).mockResolvedValue({
      url: 'https://example.invalid/photo.jpg',
      expiresAt: Date.now() + 3600000,
    })
    vi.mocked(deleteRecipePhoto).mockRejectedValueOnce(new Error('network'))
    renderApp('/meals/recipes/r1/edit', auth)
    await screen.findByRole('heading', { name: '레시피 수정' })
    await user.click(await screen.findByRole('button', { name: '사진 삭제' }))
    await user.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('레시피는 저장됐지만')
    expect(screen.getByLabelText('레시피 이름')).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(deleteRecipePhoto).toHaveBeenCalledTimes(2))
    expect(saveRecipe).toHaveBeenCalledTimes(1)
  })
  it('기존 레시피의 줄 순서와 양을 바꿔도 음식 연결과 주의 표시를 보존한다', async () => {
    const user = userEvent.setup()
    renderApp('/meals/recipes/r1/edit', auth)
    const field = await screen.findByLabelText('재료')
    await user.clear(field)
    await user.type(field, '달걀 2개{enter}쌀 50g')
    expect(screen.getByText('주의')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '저장' }))
    await waitFor(() => expect(saveRecipe).toHaveBeenCalled())
    expect(vi.mocked(saveRecipe).mock.calls[0][1]).toMatchObject({
      ingredients: [
        { foodId: 'f2', name: '달걀', amount: '2개' },
        { foodId: 'f1', name: '쌀', amount: '50g' },
      ],
      steps: ['쌀을 씻어요', '끓여요'],
    })
  })
})
