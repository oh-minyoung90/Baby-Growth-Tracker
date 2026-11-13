import { useState } from 'react'
import { CookingPot, TriangleAlert } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { AddRecordButton } from '@/components/AddRecordButton'
import { EmptyState } from '@/components/EmptyState'
import { ErrorBanner } from '@/components/ErrorBanner'
import { ListLoading } from '@/components/ListLoading'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useFoods } from '@/lib/useFoods'
import { useRecipes } from '@/lib/useRecipes'
import { RecipePhoto } from './RecipePhoto'
import { cautionIngredientNames, filterRecipes } from './recipeUtils'

export function RecipesPage() {
  const recipes = useRecipes()
  const foods = useFoods()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const foodIds = [...new Set((params.get('ingredients') ?? '').split(',').filter(Boolean))]
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }
  const setSearch = (value: string) => setParam('q', value)
  const setFoodIds = (ids: string[] | ((ids: string[]) => string[])) =>
    setParam('ingredients', (typeof ids === 'function' ? ids(foodIds) : ids).join(','))
  const [ingredientSearch, setIngredientSearch] = useState('')
  const [filterOpen, setFilterOpen] = useState(foodIds.length > 0)
  const filtered = filterRecipes(recipes.data ?? [], search, foodIds)
  return (
    <div className="flex min-w-0 flex-col gap-4 pb-20 md:pb-0">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          aria-label="레시피 이름 검색"
          placeholder="레시피 이름 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-40 flex-1"
        />
        <Button
          variant="outline"
          aria-expanded={filterOpen}
          onClick={() => setFilterOpen(!filterOpen)}
        >
          재료 필터 {foodIds.length > 0 && `(${foodIds.length})`}
        </Button>
        <AddRecordButton label="레시피 추가" onClick={() => void navigate('/meals/recipes/new')} />
      </div>
      {filterOpen && (
        <section
          aria-label="재료 필터"
          className="flex flex-col gap-3 rounded-card border bg-surface p-4"
        >
          <p className="text-sm text-muted-foreground">
            선택한 재료가 모두 들어간 레시피를 보여줘요
          </p>
          <Input
            aria-label="필터 재료 검색"
            placeholder="음식 이름 검색"
            value={ingredientSearch}
            onChange={(e) => setIngredientSearch(e.target.value)}
          />
          {foods.isPending ? (
            <ListLoading />
          ) : foods.isError ? (
            <ErrorBanner
              message="재료 목록을 불러오지 못했어요"
              onRetry={() => void foods.refetch()}
            />
          ) : (
            <div className="flex max-h-64 flex-wrap gap-2 overflow-y-auto">
              {foods.data
                ?.filter((f) => f.name.includes(ingredientSearch.trim()))
                .map((food) => (
                  <button
                    type="button"
                    key={food.id}
                    aria-pressed={foodIds.includes(food.id)}
                    onClick={() =>
                      setFoodIds((ids) =>
                        ids.includes(food.id)
                          ? ids.filter((id) => id !== food.id)
                          : [...ids, food.id],
                      )
                    }
                    className="min-h-11 rounded-full border bg-surface px-4 text-sm aria-pressed:border-2 aria-pressed:border-primary aria-pressed:bg-soft aria-pressed:text-soft-text"
                  >
                    {food.name}
                  </button>
                ))}
              {foods.data?.length === 0 && (
                <p className="text-sm text-muted-foreground">등록된 음식이 없어요</p>
              )}
            </div>
          )}
          {foodIds.length > 0 && (
            <Button variant="ghost" className="self-start" onClick={() => setFoodIds([])}>
              재료 필터 초기화
            </Button>
          )}
        </section>
      )}
      {!filterOpen && foodIds.length > 0 && (
        <Button variant="ghost" className="self-start" onClick={() => setFoodIds([])}>
          재료 필터 {foodIds.length}개 해제
        </Button>
      )}
      {foods.isError && !filterOpen && (
        <ErrorBanner
          message="주의 재료 정보를 불러오지 못했어요"
          onRetry={() => void foods.refetch()}
        />
      )}
      {recipes.isPending ? (
        <ListLoading />
      ) : recipes.isError ? (
        <ErrorBanner message="레시피를 불러오지 못했어요" onRetry={() => void recipes.refetch()} />
      ) : recipes.data.length === 0 ? (
        <EmptyState
          icon={CookingPot}
          title="등록된 레시피가 없어요"
          description="아이를 위한 레시피를 남겨 보세요"
          actionLabel="레시피 추가"
          to="/meals/recipes/new"
        />
      ) : filtered.length === 0 ? (
        <p role="status" className="py-10 text-center text-muted-foreground">
          조건에 맞는 레시피가 없어요
        </p>
      ) : (
        <ul className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((recipe) => {
            const caution = cautionIngredientNames(recipe, foods.data ?? [])
            return (
              <li key={recipe.id} className="min-w-0">
                <Link
                  to={`/meals/recipes/${recipe.id}`}
                  className="flex h-full flex-col gap-3 rounded-card border bg-surface p-4 outline-offset-4 focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <RecipePhoto id={recipe.photoId} name={recipe.name} retryable={false} />
                  <h2 className="text-lg font-bold break-words">{recipe.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    완성량 {recipe.servings ?? '미입력'}
                  </p>
                  {caution.length > 0 && (
                    <Badge variant="caution" className="self-start whitespace-normal">
                      <TriangleAlert aria-hidden />
                      주의: {caution.join(', ')}
                    </Badge>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
