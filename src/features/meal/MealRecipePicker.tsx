import { useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { ErrorBanner } from '@/components/ErrorBanner'
import { ListLoading } from '@/components/ListLoading'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toContentKey } from '@/domain/text'
import type { MealItem } from '@/lib/mealApi'
import { SelectedMealItems } from './MealFoodPicker'

/** 본인 레시피를 검색·선택한다. 삭제된 레시피 이름도 선택 상태에서 보존한다 (D7). */
export function MealRecipePicker({
  options,
  selected,
  onChange,
  onCreate,
  disabled,
  loading = false,
  failed = false,
  retrying = false,
  onRetry,
}: {
  options: readonly MealItem[]
  selected: MealItem[]
  onChange: (items: MealItem[]) => void
  onCreate: (id: string, name: string) => Promise<void>
  disabled: boolean
  loading?: boolean
  failed?: boolean
  retrying?: boolean
  onRetry?: () => void
}) {
  const [query, setQuery] = useState('')
  const [createFailed, setCreateFailed] = useState(false)
  const draft = useRef<{ id: string; name: string } | null>(null)
  const name = query.trim()
  const key = toContentKey(name)
  const matching = options.filter(
    (item) => item.id !== null && toContentKey(item.name).includes(key),
  )
  const canCreate = key && !matching.some((item) => toContentKey(item.name) === key)
  const select = (item: MealItem) => {
    onChange([...selected, item])
    setQuery('')
    setCreateFailed(false)
  }
  const create = async () => {
    if (!canCreate || disabled) return
    // 응답을 받지 못한 저장을 다시 시도할 때 같은 ID를 사용한다.
    const item = draft.current?.name === name ? draft.current : { id: crypto.randomUUID(), name }
    draft.current = item
    setCreateFailed(false)
    try {
      await onCreate(item.id, item.name)
      draft.current = null
      select(item)
    } catch {
      setCreateFailed(true)
    }
  }
  return (
    <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-2">
      <legend className="mb-2 text-sm font-bold">레시피</legend>
      <SelectedMealItems
        label="선택한 레시피"
        items={selected}
        onChange={onChange}
        disabled={disabled}
      />
      <Input
        type="search"
        aria-label="식단에 넣을 레시피 검색"
        placeholder="레시피 검색 또는 이름 입력"
        maxLength={30}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setCreateFailed(false)
        }}
      />
      {loading ? (
        <ListLoading rows={1} />
      ) : failed ? (
        <ErrorBanner
          message="레시피와 재료 정보를 불러오지 못했어요. 다시 시도해 주세요."
          onRetry={onRetry}
          retrying={retrying}
        />
      ) : matching.length ? (
        <ul
          aria-label="레시피 검색 결과"
          className="max-h-40 overflow-y-auto rounded-button border divide-y"
        >
          {matching.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                disabled={selected.some((picked) => picked.id === item.id)}
                onClick={() => select(item)}
                className="min-h-12 w-full px-3 py-2 text-left text-sm outline-none hover:bg-soft focus-visible:bg-soft disabled:bg-muted"
              >
                {item.name}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        !canCreate && (
          <p className="text-[13px] text-muted-foreground">
            {options.length || query ? '검색 결과가 없어요' : '등록된 레시피가 없어요'}
          </p>
        )
      )}
      {!loading && !failed && canCreate && (
        <>
          {createFailed && (
            <ErrorBanner message="레시피를 추가하지 못했어요. 다시 시도해 주세요." />
          )}
          <Button
            type="button"
            variant="soft"
            className="h-auto min-h-12 justify-start whitespace-normal"
            onClick={() => void create()}
          >
            <Plus aria-hidden />
            <span className="min-w-0 break-words">‘{name}’ 레시피 추가</span>
          </Button>
        </>
      )}
    </fieldset>
  )
}
