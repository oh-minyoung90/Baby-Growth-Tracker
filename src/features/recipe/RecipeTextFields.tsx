import { useState } from 'react'
import type { Control } from 'react-hook-form'
import { useController } from 'react-hook-form'
import { TriangleAlert } from 'lucide-react'
import { Field } from '@/components/form/Field'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { Food } from '@/lib/foodApi'
import type { RecipeFormOutput, RecipeFormValues } from './recipeSchema'
import { ingredientKey, parseRecipeIngredients, parseRecipeSteps } from './recipeText'

type Props = { control: Control<RecipeFormValues, unknown, RecipeFormOutput> }
export function RecipeIngredientsField({
  control,
  foods,
  links,
  onLink,
}: Props & {
  foods: readonly Food[]
  links: Record<string, string | null>
  onLink: (key: string, id: string | null) => void
}) {
  const { field, fieldState } = useController({ control, name: 'ingredientsText' })
  const items = parseRecipeIngredients(field.value)
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <Field
        id="recipe-ingredients"
        label="재료"
        error={fieldState.error?.message}
        aside={<span className="text-xs text-muted-foreground">{items.length}개</span>}
      >
        <p id="recipe-ingredients-help" className="text-sm text-muted-foreground">
          한 줄에 재료 하나씩 입력하거나 붙여 넣어 주세요. 예: 계란 1개. 이름과 양은 |로도 구분할 수
          있어요.
        </p>
        <Textarea
          {...field}
          id="recipe-ingredients"
          rows={6}
          className="min-h-40"
          placeholder={'아기용 만두 3~4개\n계란 1개\n물 또는 멸치·채소 육수 300ml'}
          aria-invalid={!!fieldState.error}
          aria-describedby={`recipe-ingredients-help${fieldState.error ? ' recipe-ingredients-error' : ''}`}
        />
      </Field>
      {items.length > 0 && (
        <div className="rounded-input border bg-surface p-3">
          <h2 className="mb-2 text-sm font-bold">재료 미리보기</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            필요한 재료는 음식 목록과 연결해 주의 표시와 재료 필터에 사용할 수 있어요. 직접 입력만
            하면 음식 목록에 추가되지 않아요.
          </p>
          <ol aria-label="재료 미리보기" className="divide-y">
            {items.map((item, index) => {
              const key = ingredientKey(items, index)
              return (
                <li key={key} className="flex min-w-0 gap-2 py-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-soft text-xs font-bold text-soft-text">
                    {index + 1}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <span className="min-w-0 break-words">
                        {item.name || '이름을 입력해 주세요'}
                      </span>
                      {item.amount && (
                        <span className="text-sm break-words text-muted-foreground">
                          {item.amount}
                        </span>
                      )}
                    </div>
                    <IngredientLink
                      index={index}
                      name={item.name}
                      foods={foods}
                      selectedId={links[key] ?? null}
                      onSelect={(id) => onLink(key, id)}
                    />
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </section>
  )
}
function IngredientLink({
  index,
  name,
  foods,
  selectedId,
  onSelect,
}: {
  index: number
  name: string
  foods: readonly Food[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(name)
  const selected = foods.find((food) => food.id === selectedId)
  const options = foods.filter((food) => food.name.includes(query.trim()))
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`재료 ${index + 1} 음식 연결`}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {selectedId ? `연결: ${selected?.name ?? '기존 음식'}` : '음식 연결'}
        </Button>
        {selected && (selected.status === 'caution' || selected.cautionTag) && (
          <Badge variant="caution">
            <TriangleAlert aria-hidden />
            주의
          </Badge>
        )}
        {selectedId && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`재료 ${index + 1} 연결 해제`}
            onClick={() => onSelect(null)}
          >
            연결 해제
          </Button>
        )}
      </div>
      {open && (
        <div className="flex min-w-0 flex-col gap-2">
          <Input
            aria-label={`재료 ${index + 1} 음식 검색`}
            placeholder="음식 이름 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul
            aria-label={`재료 ${index + 1} 검색 결과`}
            className="max-h-48 overflow-auto rounded-input border"
          >
            {options.map((food) => (
              <li key={food.id}>
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left hover:bg-soft"
                  onClick={() => {
                    onSelect(food.id)
                    setOpen(false)
                  }}
                >
                  {food.name}
                  {(food.status === 'caution' || food.cautionTag) && (
                    <Badge variant="caution">
                      <TriangleAlert aria-hidden />
                      주의
                    </Badge>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {options.length === 0 && (
            <p className="text-sm text-muted-foreground">
              일치하는 음식이 없어요. 직접 입력한 이름으로 저장돼요.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
export function RecipeStepsField({ control }: Props) {
  const { field, fieldState } = useController({ control, name: 'stepsText' })
  const steps = parseRecipeSteps(field.value)
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <Field
        id="recipe-steps"
        label="조리 순서"
        error={fieldState.error?.message}
        aside={<span className="text-xs text-muted-foreground">{steps.length}단계</span>}
      >
        <p id="recipe-steps-help" className="text-sm text-muted-foreground">
          줄을 바꾸면 다음 단계로 나눠져요. 1. 또는 1)처럼 번호가 있는 글은 다음 번호까지 한 단계로
          묶어요. 빈 줄은 제외해요.
        </p>
        <Textarea
          {...field}
          id="recipe-steps"
          rows={8}
          className="min-h-48"
          placeholder={'채소를 잘게 썰어요\n육수를 넣고 끓여요\n만두를 넣고 충분히 익혀요'}
          aria-invalid={!!fieldState.error}
          aria-describedby={`recipe-steps-help${fieldState.error ? ' recipe-steps-error' : ''}`}
        />
      </Field>
      {steps.length > 0 && (
        <div className="rounded-input border bg-surface p-3">
          <h2 className="mb-3 text-sm font-bold">조리 순서 미리보기</h2>
          <ol aria-label="조리 순서 미리보기" className="flex flex-col gap-3">
            {steps.map((step, index) => (
              <li key={index} className="flex min-w-0 gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-soft text-xs font-bold text-soft-text">
                  {index + 1}
                </span>
                <p className="min-w-0 flex-1 break-words whitespace-pre-wrap">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}
