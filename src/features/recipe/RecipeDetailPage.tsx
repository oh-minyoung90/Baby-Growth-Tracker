import { ChevronLeft, Pencil, TriangleAlert } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { ErrorBanner } from '@/components/ErrorBanner'
import { ListLoading } from '@/components/ListLoading'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useFoods } from '@/lib/useFoods'
import { useRecipe } from '@/lib/useRecipes'
import { useGoBack } from '@/lib/useGoBack'
import { RecipePhoto } from './RecipePhoto'

export function RecipeDetailPage() {
  const { id } = useParams()
  const recipe = useRecipe(id)
  const foods = useFoods()
  const goBack = useGoBack('/meals/recipes')
  const cautionIds = new Set(
    (foods.data ?? []).filter((f) => f.status === 'caution' || f.cautionTag).map((f) => f.id),
  )
  const data = recipe.data
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Button variant="ghost" className="self-start" onClick={goBack}>
        <ChevronLeft aria-hidden />
        레시피 목록으로
      </Button>
      {recipe.isPending ? (
        <ListLoading />
      ) : recipe.isError ? (
        <ErrorBanner message="레시피를 불러오지 못했어요" onRetry={() => void recipe.refetch()} />
      ) : !data ? (
        <p role="alert">레시피를 찾을 수 없어요. 삭제되었거나 접근할 수 없는 레시피예요.</p>
      ) : (
        <>
          <header className="flex min-w-0 items-center justify-between gap-3">
            <h2 className="min-w-0 text-xl font-bold break-words">{data.name}</h2>
            <Button asChild variant="soft">
              <Link to={`/meals/recipes/${data.id}/edit`}>
                <Pencil aria-hidden />
                수정
              </Link>
            </Button>
          </header>
          <div className="grid min-w-0 gap-5 lg:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-4">
              <RecipePhoto id={data.photoId} name={data.name} />
              <p className="text-sm text-muted-foreground">완성량 {data.servings ?? '미입력'}</p>
            </div>
            <div className="flex min-w-0 flex-col gap-5">
              <section className="rounded-card border bg-surface p-5">
                <h3 className="mb-3 text-lg font-bold">재료</h3>
                {foods.isPending && (
                  <p role="status" className="mb-3 text-sm text-muted-foreground">
                    주의 재료 확인 중…
                  </p>
                )}
                {foods.isError && (
                  <ErrorBanner
                    message="주의 재료 정보를 불러오지 못했어요"
                    onRetry={() => void foods.refetch()}
                  />
                )}
                <ul className="divide-y">
                  {data.ingredients.map((i, index) => (
                    <li key={index} className="flex min-w-0 flex-wrap items-center gap-2 py-3">
                      <span className="min-w-0 flex-1 break-words">{i.name}</span>
                      <span className="text-sm text-muted-foreground">{i.amount}</span>
                      {i.foodId && cautionIds.has(i.foodId) && (
                        <Badge variant="caution">
                          <TriangleAlert aria-hidden />
                          주의
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
              <section className="rounded-card border bg-surface p-5">
                <h3 className="mb-3 text-lg font-bold">조리 순서</h3>
                <ol className="flex flex-col gap-4">
                  {data.steps.map((step, index) => (
                    <li key={index} className="flex gap-3">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-soft text-sm font-bold text-soft-text">
                        {index + 1}
                      </span>
                      <p className="min-w-0 pt-0.5 break-words whitespace-pre-wrap">{step}</p>
                    </li>
                  ))}
                </ol>
              </section>
              {data.note && (
                <section className="rounded-card border bg-surface p-5">
                  <h3 className="mb-3 text-lg font-bold">참고</h3>
                  <p className="break-words whitespace-pre-wrap">{data.note}</p>
                </section>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
