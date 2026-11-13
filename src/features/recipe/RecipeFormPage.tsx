import { useNavigate, useParams } from 'react-router'
import { ErrorBanner } from '@/components/ErrorBanner'
import { FormPage } from '@/components/FormPage'
import { ListLoading } from '@/components/ListLoading'
import { useRecipe } from '@/lib/useRecipes'
import { useGoBack } from '@/lib/useGoBack'
import { RecipeForm } from './RecipeForm'
export function RecipeFormPage() {
  const { id } = useParams()
  const recipe = useRecipe(id)
  const goBack = useGoBack(id ? `/meals/recipes/${id}` : '/meals/recipes')
  const navigate = useNavigate()
  if (id && (recipe.isPending || recipe.isError || !recipe.data))
    return (
      <FormPage title="레시피 수정" onBack={goBack}>
        {recipe.isPending ? (
          <ListLoading />
        ) : recipe.isError ? (
          <ErrorBanner message="레시피를 불러오지 못했어요" onRetry={() => void recipe.refetch()} />
        ) : (
          <p role="alert">레시피를 찾을 수 없어요. 삭제되었거나 접근할 수 없는 레시피예요.</p>
        )}
      </FormPage>
    )
  return (
    <RecipeForm
      key={id ?? 'new'}
      initial={id ? (recipe.data ?? undefined) : undefined}
      onDone={goBack}
      onDeleted={() => void navigate('/meals/recipes', { replace: true })}
    />
  )
}
