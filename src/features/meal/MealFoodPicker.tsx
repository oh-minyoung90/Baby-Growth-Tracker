import { useState } from 'react'
import { Check, Plus, Search, TriangleAlert, X } from 'lucide-react'
import { ChoiceChips } from '@/components/ChoiceChips'
import { ErrorBanner } from '@/components/ErrorBanner'
import { FieldError } from '@/components/form/Field'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toContentKey } from '@/domain/text'
import { FoodSaveError, type Food } from '@/lib/foodApi'
import { FOOD_GROUPS, foodGroupLabel, type FoodGroup } from '@/lib/foodTypes'
import type { MealItem } from '@/lib/mealApi'
import { useFoods, useSaveFood } from '@/lib/useFoods'

/** 식단에서 음식 선택·신규 음식 추가 (FR-MEAL-06). 음식 생성 실패는 식단 입력을 지우지 않는다. */
export function MealFoodPicker({
  selected,
  onChange,
  error,
  disabled,
  onPendingChange,
}: {
  selected: MealItem[]
  onChange: (items: MealItem[]) => void
  error?: string
  disabled: boolean
  onPendingChange: (pending: boolean) => void
}) {
  const foods = useFoods()
  const saveFood = useSaveFood()
  const [query, setQuery] = useState('')
  const [newName, setNewName] = useState<string | null>(null)
  const [group, setGroup] = useState<FoodGroup | ''>('')
  const [failed, setFailed] = useState<'network' | 'duplicate' | 'group' | 'name' | null>(null)
  const all = foods.data ?? []
  const key = toContentKey(query)
  const matching = all.filter((food) => toContentKey(food.name).includes(key))
  const exact = all.some((food) => toContentKey(food.name) === key)
  const busy = disabled || saveFood.isPending
  const select = (food: Food) => {
    if (!selected.some((item) => item.id === food.id))
      onChange([...selected, { id: food.id, name: food.name }])
    setQuery('')
    setFailed(null)
  }
  const create = async () => {
    if (!group || !newName) {
      setFailed('group')
      return
    }
    setFailed(null)
    onPendingChange(true)
    try {
      const added = await saveFood.mutateAsync({
        input: {
          name: newName,
          group,
          alreadyTried: false,
          firstTriedDate: null,
          memo: null,
          preference: null,
        },
      })
      select(added)
      setNewName(null)
    } catch (error) {
      if (error instanceof FoodSaveError && error.reason === 'duplicateName') {
        await foods.refetch()
        setNewName(null)
        setFailed('duplicate')
      } else if (error instanceof FoodSaveError && error.reason === 'nameLength') setFailed('name')
      else setFailed('network')
    } finally {
      onPendingChange(false)
    }
  }
  return (
    <fieldset disabled={busy} className="flex min-w-0 flex-col gap-2">
      <legend className="mb-2 text-sm font-bold">음식</legend>
      <SelectedMealItems label="선택한 음식" items={selected} onChange={onChange} disabled={busy} />
      {failed === 'duplicate' && (
        <FieldError>이미 있는 음식이에요. 검색 결과에서 골라 주세요</FieldError>
      )}
      {error && <FieldError id="meal-foods-error">{error}</FieldError>}
      {newName !== null ? (
        <div className="flex flex-col gap-3 rounded-button border bg-muted/50 p-3">
          <p className="text-sm font-bold">‘{newName}’ 새 음식으로 추가</p>
          <p className="text-[13px] text-muted-foreground">식품군을 골라 주세요</p>
          <ChoiceChips
            label="새 음식 식품군"
            options={[...FOOD_GROUPS]}
            value={group}
            onChange={(value) => {
              setGroup(value)
              setFailed(null)
            }}
          />
          {failed === 'group' && <FieldError>식품군을 골라 주세요</FieldError>}
          {failed === 'name' && <FieldError>음식 이름은 20자까지 입력할 수 있어요</FieldError>}
          {failed === 'network' && (
            <ErrorBanner onRetry={() => void create()} retrying={saveFood.isPending} />
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="soft"
              onClick={() => {
                setNewName(null)
                setFailed(null)
              }}
            >
              추가 취소
            </Button>
            <Button type="button" onClick={() => void create()}>
              {saveFood.isPending ? '추가하는 중…' : '음식 추가'}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              aria-label="식단에 넣을 음식 검색"
              aria-invalid={!!error}
              aria-describedby={error ? 'meal-foods-error' : undefined}
              placeholder="음식 이름 검색"
              maxLength={20}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setFailed(null)
              }}
              className="pl-10 focus-visible:pl-[39px] aria-invalid:pl-[39px]"
            />
          </div>
          {foods.isPending ? (
            <p role="status" className="text-sm text-muted-foreground">
              음식을 불러오는 중…
            </p>
          ) : foods.isError ? (
            <ErrorBanner onRetry={() => void foods.refetch()} retrying={foods.isFetching} />
          ) : (
            <>
              <ul
                aria-label="음식 검색 결과"
                className="max-h-48 overflow-y-auto overscroll-contain rounded-button border divide-y"
              >
                {matching.map((food) => {
                  const picked = selected.some((item) => item.id === food.id)
                  return (
                    <li key={food.id}>
                      <button
                        type="button"
                        aria-pressed={picked}
                        disabled={picked}
                        onClick={() => select(food)}
                        className="flex min-h-12 w-full items-center gap-2 px-3 py-2 text-left text-sm outline-none hover:bg-soft focus-visible:bg-soft disabled:bg-muted"
                      >
                        <span className="min-w-0 flex-1 break-words">{food.name}</span>
                        {(food.status === 'caution' || food.cautionTag) && (
                          <Badge variant="caution">
                            <TriangleAlert aria-hidden />
                            주의
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {foodGroupLabel(food.group)}
                        </span>
                        {picked && <Check className="size-4 text-primary" aria-hidden />}
                      </button>
                    </li>
                  )
                })}
                {key && !exact && (
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        setNewName(query.trim())
                        setGroup('')
                        setFailed(null)
                      }}
                      className="flex min-h-12 w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold text-soft-text outline-none hover:bg-soft focus-visible:bg-soft"
                    >
                      <Plus className="size-4 shrink-0" aria-hidden />‘{query.trim()}’ 새 음식으로
                      추가
                    </button>
                  </li>
                )}
              </ul>
              {!matching.length && !key && (
                <p className="text-[13px] text-muted-foreground">
                  음식 이름을 입력해 추가해 보세요
                </p>
              )}
            </>
          )}
        </>
      )}
    </fieldset>
  )
}

export function SelectedMealItems({
  label,
  items,
  onChange,
  disabled,
}: {
  label: string
  items: MealItem[]
  onChange: (items: MealItem[]) => void
  disabled: boolean
}) {
  if (!items.length) return null
  return (
    <ul aria-label={label} className="flex flex-wrap gap-2">
      {items.map((item, index) => (
        <li key={`${item.id ?? 'deleted'}:${index}`}>
          <button
            type="button"
            disabled={disabled}
            aria-label={`${item.name} 빼기`}
            onClick={() => onChange(items.filter((_, position) => index !== position))}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-primary bg-soft px-3 text-sm font-medium text-soft-text outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {item.name}
            <X className="size-3.5 shrink-0" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  )
}
