import { useState } from 'react'
import { Carrot, Search, TriangleAlert } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { AddRecordButton } from '@/components/AddRecordButton'
import { ChoiceChips } from '@/components/ChoiceChips'
import { EmptyState } from '@/components/EmptyState'
import { ErrorBanner } from '@/components/ErrorBanner'
import { ListLoading } from '@/components/ListLoading'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import type { Food } from '@/lib/foodApi'
import { FOOD_GROUPS, FOOD_STATUSES, type FoodStatus } from '@/lib/foodTypes'
import { NETWORK_ERROR_MESSAGES } from '@/lib/messages'
import { notifyDone } from '@/lib/notify'
import { useChild } from '@/lib/useChild'
import { useFoods, useSeedDefaultFoods } from '@/lib/useFoods'
import { useSheetParam } from '@/lib/useSheetParam'
import { FoodForm } from './FoodForm'
import { FoodList } from './FoodList'
import {
  countByStatus,
  filterFoods,
  filterFromParams,
  filterToParams,
  type FoodGroupFilter,
} from './foodFilter'

const GROUP_OPTIONS: { value: FoodGroupFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  ...FOOD_GROUPS,
]

/** 탭에 음식이 하나도 없을 때의 안내 */
const EMPTY_TAB_MESSAGES: Record<FoodStatus, { title: string; description?: string }> = {
  tried: {
    title: '아직 먹어 본 음식이 없어요',
    description: '먹어 본 음식을 추가하거나, 안 먹어봄 음식을 먹어봄으로 바꾸면 여기에 모여요',
  },
  not_tried: {
    title: '아직 안 먹어 본 음식이 없어요',
    description: '새로 시도할 음식을 추가해 보세요',
  },
  caution: { title: '알러지·주의 음식이 없어요' },
}

/**
 * 식사 > 음식 목록 (SCR-10, FR-FOOD-01~08): 상태 탭과 개수, 식품군 필터, 이름 검색, 음식 목록, 추가·수정 시트.
 * 탭과 식품군은 주소에 둔다(?status=&group=). 추가·수정 시트도 주소로 연다: ?record=new, ?record=<id>
 */
export function FoodsPage() {
  const { data: child } = useChild()
  const foods = useFoods()
  const seed = useSeedDefaultFoods()
  const sheet = useSheetParam()
  const [params, setParams] = useSearchParams()
  const { status, group } = filterFromParams(params)
  const [query, setQuery] = useState('')

  const all = foods.data ?? []
  const hasFoods = all.length > 0
  const editing =
    sheet.value && sheet.value !== 'new' ? all.find((food) => food.id === sheet.value) : undefined
  const sheetOpen = sheet.value === 'new' || editing !== undefined

  const setFilter = (next: { status?: FoodStatus; group?: FoodGroupFilter }) =>
    setParams(filterToParams(params, { status, group, ...next }), { replace: true })

  const seedFoods = async () => {
    try {
      const added = await seed.mutateAsync()
      // 기본 음식은 아직 안 먹어봄으로 들어가므로 그 탭을 보여 준다
      setFilter({ status: 'not_tried', group: 'all' })
      notifyDone(`기본 음식 ${added}개를 추가했어요`)
    } catch {
      // 아래 ErrorBanner로 알린다
    }
  }

  return (
    // 모바일에서 떠 있는 추가 버튼이 마지막 음식을 가리지 않게 아래를 비운다
    <div className="flex flex-col gap-3 pb-20 md:pb-0">
      {foods.data && (
        <StatusTabs
          counts={countByStatus(all)}
          value={status}
          onChange={(next) => setFilter({ status: next })}
        />
      )}

      {hasFoods && (
        <ChoiceChips
          label="식품군"
          options={GROUP_OPTIONS}
          value={group}
          onChange={(next) => setFilter({ group: next })}
        />
      )}
      <div className="flex items-center justify-end gap-3">
        {hasFoods && <SearchInput value={query} onChange={setQuery} />}
        <AddRecordButton label="음식 추가" onClick={() => sheet.open('new')} />
      </div>

      {seed.isError && (
        <ErrorBanner
          message={NETWORK_ERROR_MESSAGES.save}
          onRetry={() => void seedFoods()}
          retrying={seed.isPending}
        />
      )}

      {foods.isPending ? (
        <ListLoading />
      ) : foods.isError ? (
        <ErrorBanner
          message={NETWORK_ERROR_MESSAGES.load}
          onRetry={() => void foods.refetch()}
          retrying={foods.isFetching}
        />
      ) : !hasFoods ? (
        // 음식이 하나도 없으면 기본 음식 목록을 넣을 수 있게 한다 (FR-FOOD-07, R45)
        <EmptyState
          icon={Carrot}
          title="아직 음식이 없어요"
          description="자주 먹는 이유식 재료 42개를 한 번에 추가할 수 있어요. 하나씩 직접 추가해도 돼요"
          actionLabel={seed.isPending ? '추가하는 중…' : '기본 음식 추가'}
          onAction={() => void seedFoods()}
          actionPending={seed.isPending}
        />
      ) : (
        <FilteredList
          foods={all}
          status={status}
          group={group}
          query={query}
          onSelect={(id) => sheet.open(id)}
        />
      )}

      {child && (
        <FoodSheet
          open={sheetOpen}
          initial={editing}
          birthDate={child.birthDate}
          foods={all}
          // 먹어봄 탭에서 추가하면 먹어봄으로 시작한다 (R47)
          defaultTried={status === 'tried'}
          onClose={sheet.close}
          // 같은 이름의 음식을 열 때는 주소를 바꿔 끼워, 닫으면 시트를 열기 전 화면으로 돌아가게 한다
          onEditExisting={(id) => sheet.open(id, { replace: true })}
        />
      )}
    </div>
  )
}

function FilteredList({
  foods,
  status,
  group,
  query,
  onSelect,
}: {
  foods: readonly Food[]
  status: FoodStatus
  group: FoodGroupFilter
  query: string
  onSelect: (id: string) => void
}) {
  const visible = filterFoods(foods, { status, group, query })
  if (visible.length > 0) return <FoodList foods={visible} onSelect={onSelect} />

  // 탭에 음식이 있는데 식품군·검색어에 맞는 것이 없으면 조건을 바꾸도록 안내한다
  const tabEmpty = !foods.some((food) => food.status === status)
  const message = tabEmpty
    ? EMPTY_TAB_MESSAGES[status]
    : { title: '조건에 맞는 음식이 없어요', description: '식품군이나 검색어를 바꿔 보세요' }
  return <EmptyState icon={Carrot} title={message.title} description={message.description} />
}

/**
 * 상태 탭 3개와 탭별 개수 (FR-FOOD-01, 시안 D-07). 좁은 화면에 맞춰 짧은 이름을 보여 주고,
 * 화면 낭독기에는 전체 이름과 개수를 읽어 준다. 알러지·주의는 경고 아이콘을 함께 둔다 (FR-FOOD-14)
 */
function StatusTabs({
  counts,
  value,
  onChange,
}: {
  counts: Record<FoodStatus, number>
  value: FoodStatus
  onChange: (value: FoodStatus) => void
}) {
  return (
    <div role="group" aria-label="음식 상태" className="flex border-b border-line">
      {FOOD_STATUSES.map((status) => (
        <button
          key={status.value}
          type="button"
          aria-pressed={value === status.value}
          aria-label={`${status.label} ${counts[status.value]}개`}
          onClick={() => onChange(status.value)}
          className="-mb-px flex h-12 flex-1 items-center justify-center gap-1 border-b-3 border-transparent text-[15px] font-bold text-muted-foreground transition-colors aria-pressed:border-primary aria-pressed:text-primary"
        >
          {status.value === 'caution' && <TriangleAlert className="size-4" aria-hidden />}
          {status.shortLabel}
          <span className="font-medium tabular-nums">{counts[status.value]}</span>
        </button>
      ))}
    </div>
  )
}

function SearchInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="relative min-w-0 flex-1">
      <Search
        className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        aria-label="음식 이름 검색"
        placeholder="음식 이름 검색"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="pl-11 focus-visible:pl-[43px]"
      />
    </div>
  )
}

/** 추가·수정 바텀 시트 */
function FoodSheet({
  open,
  initial,
  birthDate,
  foods,
  defaultTried,
  onClose,
  onEditExisting,
}: {
  open: boolean
  initial: Food | undefined
  birthDate: string
  foods: readonly Food[]
  defaultTried: boolean
  onClose: () => void
  onEditExisting: (id: string) => void
}) {
  // 닫히는 동안(애니메이션)에도 열려 있던 내용을 유지한다. 수정 시트가 닫히며 빈 입력 화면으로 바뀌어 보이지 않게
  const [shown, setShown] = useState(initial)
  if (open && shown !== initial) setShown(initial)

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      {/* 설명 문구가 없는 창이라 aria-describedby를 비운다 (Radix 경고 방지) */}
      <SheetContent aria-describedby={undefined}>
        <SheetTitle>{shown ? '음식 수정' : '음식 추가'}</SheetTitle>
        <FoodForm
          key={shown?.id ?? 'new'}
          initial={shown}
          defaultTried={defaultTried}
          birthDate={birthDate}
          foods={foods}
          onDone={onClose}
          onEditExisting={onEditExisting}
        />
      </SheetContent>
    </Sheet>
  )
}
