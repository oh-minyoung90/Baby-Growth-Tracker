import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { ChevronLeft, Pencil, TriangleAlert } from 'lucide-react'
import { ChoiceChips } from '@/components/ChoiceChips'
import { ErrorBanner } from '@/components/ErrorBanner'
import { ListLoading } from '@/components/ListLoading'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateLabel } from '@/domain/date'
import type { Food } from '@/lib/foodApi'
import type { FoodStatusHistory } from '@/lib/foodDetailApi'
import {
  FOOD_PREFERENCES,
  FOOD_STATUSES,
  foodGroupLabel,
  foodPreferenceLabel,
} from '@/lib/foodTypes'
import { mealIntakeLabel, mealTypeLabel } from '@/lib/mealTypes'
import { notifyDone, notifySaved } from '@/lib/notify'
import { useChild } from '@/lib/useChild'
import {
  useFood,
  useFoodEatenMeals,
  useFoodMealCounts,
  useFoodStatusHistory,
  useSetFoodPreference,
} from '@/lib/useFoodDetails'
import { useClearCautionTag, useFoods } from '@/lib/useFoods'
import { useGoBack } from '@/lib/useGoBack'
import { useSheetParam } from '@/lib/useSheetParam'
import { FoodSheet } from './FoodSheet'
import { ReasonDialog } from './ReasonDialog'

export function FoodDetailPage() {
  const { id = '' } = useParams()
  const food = useFood(id)
  const goBack = useGoBack('/meals/foods')
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Button variant="ghost" className="self-start" onClick={goBack}>
        <ChevronLeft aria-hidden />
        음식 목록으로
      </Button>
      {food.isPending ? (
        <ListLoading />
      ) : food.isError ? (
        <ErrorBanner
          message="음식 정보를 불러오지 못했어요"
          onRetry={() => void food.refetch()}
          retrying={food.isFetching}
        />
      ) : food.data ? (
        <FoodDetail key={id} food={food.data} />
      ) : (
        <p role="alert">음식을 찾을 수 없어요. 삭제되었거나 접근할 수 없는 음식이에요.</p>
      )}
    </div>
  )
}

function FoodDetail({ food }: { food: Food }) {
  const counts = useFoodMealCounts()
  const meals = useFoodEatenMeals(food.id)
  const history = useFoodStatusHistory(food.id)
  const preference = useSetFoodPreference()
  const clearTag = useClearCautionTag()
  const all = useFoods()
  const child = useChild()
  const sheet = useSheetParam()
  const navigate = useNavigate()
  const [clearing, setClearing] = useState(false)
  const [failedPreference, setFailedPreference] = useState<{ value: Food['preference'] } | null>(
    null,
  )
  const savePreference = async (value: Food['preference']) => {
    if (preference.isPending || food.status !== 'tried') return
    setFailedPreference(null)
    try {
      await preference.mutateAsync({ id: food.id, preference: value })
      notifySaved()
    } catch {
      setFailedPreference({ value })
    }
  }
  const statusLabel = (value: string) =>
    FOOD_STATUSES.find((item) => item.value === value)?.label ?? value
  return (
    <>
      <header className="flex min-w-0 items-center justify-between gap-3">
        <h2 className="min-w-0 text-xl font-bold break-words">{food.name}</h2>
        <Button variant="soft" onClick={() => sheet.open(food.id)}>
          <Pencil className="size-4" aria-hidden />
          수정
        </Button>
      </header>
      <Card title="음식 정보">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm">
          <Info label="식품군">{foodGroupLabel(food.group)}</Info>
          <Info label="상태">
            <Badge
              variant={
                food.status === 'caution'
                  ? 'caution'
                  : food.status === 'tried'
                    ? 'tried'
                    : 'outline'
              }
            >
              {statusLabel(food.status)}
            </Badge>
            {food.cautionTag && (
              <Badge variant="caution" className="ml-2">
                <TriangleAlert aria-hidden />
                주의
              </Badge>
            )}
          </Info>
          <Info label="처음 먹은 날">
            {food.firstTriedDate ? formatDateLabel(food.firstTriedDate) : '모름'}
          </Info>
          <Info label="먹은 횟수">
            {counts.data
              ? `${counts.data[food.id] ?? 0}번`
              : counts.isError
                ? '확인하지 못했어요'
                : '확인 중…'}
          </Info>
          <Info label="메모">{food.memo || '없음'}</Info>
        </dl>
        <p className="text-xs text-muted-foreground">
          먹음으로 체크한 식단만 세요. 레시피 재료로만 들어간 음식은 포함하지 않아요.
        </p>
        {counts.isError && (
          <ErrorBanner
            message="먹은 횟수를 불러오지 못했어요"
            onRetry={() => void counts.refetch()}
            retrying={counts.isFetching}
          />
        )}
      </Card>
      <Card title="아이 반응">
        <p className="text-sm text-muted-foreground">
          {food.preference ? foodPreferenceLabel(food.preference) : '아직 입력하지 않았어요'}
        </p>
        {food.status === 'tried' && (
          <fieldset disabled={preference.isPending} aria-busy={preference.isPending}>
            <ChoiceChips
              label="아이 반응"
              options={FOOD_PREFERENCES.map((item) => ({ ...item }))}
              value={food.preference ?? ''}
              onChange={(value) =>
                void savePreference(
                  value === food.preference ? null : (value as Food['preference']),
                )
              }
            />
            <p className="mt-2 text-xs text-muted-foreground">
              고른 반응을 다시 누르면 선택을 해제해요. 식단의 먹은 정도와는 별도로 기록돼요.
            </p>
          </fieldset>
        )}
        {failedPreference && (
          <ErrorBanner
            message="반응을 저장하지 못했어요. 음식 상태를 확인하고 다시 시도해 주세요"
            onRetry={
              food.status === 'tried'
                ? () => void savePreference(failedPreference.value)
                : undefined
            }
            retrying={preference.isPending}
          />
        )}
      </Card>
      {(food.status === 'caution' || food.cautionTag) && (
        <Card title="알러지·주의 정보">
          <p className="flex items-center gap-1.5 text-sm font-bold text-danger-text">
            <TriangleAlert className="size-4 shrink-0" aria-hidden />
            {food.cautionTag ? '주의: 알러지·주의였던 음식을 먹었어요' : '주의가 필요한 음식이에요'}
          </p>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm">
            <CautionDetails
              reactionDate={food.reactionDate}
              symptom={food.symptomNote}
              check={food.checkNote}
            />
          </dl>
          {food.cautionTag && (
            <Button variant="outline" className="self-start" onClick={() => setClearing(true)}>
              &quot;주의&quot; 태그 해제
            </Button>
          )}
        </Card>
      )}
      <Card title="먹은 식단">
        {meals.isPending ? (
          <ListLoading rows={2} />
        ) : meals.isError && !meals.data ? (
          <ErrorBanner
            message="먹은 식단을 불러오지 못했어요"
            onRetry={() => void meals.refetch()}
          />
        ) : (
          <>
            {meals.data?.pages[0].items.length === 0 ? (
              <p className="text-sm text-muted-foreground">먹음으로 기록한 식단이 없어요</p>
            ) : (
              <ul aria-label="먹은 식단" className="divide-y">
                {meals.data?.pages
                  .flatMap((page) => page.items)
                  .map((meal) => (
                    <li key={meal.id}>
                      <Link
                        className="flex min-h-12 flex-wrap items-center justify-between gap-2 rounded-button py-3 text-sm outline-none hover:bg-soft focus-visible:ring-2 focus-visible:ring-ring"
                        to={`/meals/week?week=${meal.date}&record=${meal.id}`}
                      >
                        <span>
                          {formatDateLabel(meal.date)} · {mealTypeLabel(meal.type)}
                        </span>
                        <span className="text-muted-foreground">
                          {meal.intake ? mealIntakeLabel(meal.intake) : '먹은 정도 미입력'}
                        </span>
                      </Link>
                    </li>
                  ))}
              </ul>
            )}
            {meals.isError && (
              <ErrorBanner
                message="식단을 더 불러오지 못했어요"
                onRetry={() =>
                  void (meals.isFetchNextPageError ? meals.fetchNextPage() : meals.refetch())
                }
              />
            )}
            {meals.hasNextPage && (
              <Button
                variant="soft"
                disabled={meals.isFetchingNextPage}
                onClick={() => void meals.fetchNextPage()}
              >
                식단 더 보기
              </Button>
            )}
          </>
        )}
      </Card>
      <Card title="상태 변경 이력">
        {history.isPending ? (
          <ListLoading rows={2} />
        ) : history.isError && !history.data ? (
          <ErrorBanner
            message="상태 이력을 불러오지 못했어요"
            onRetry={() => void history.refetch()}
          />
        ) : (
          <>
            {history.data?.pages[0].items.length === 0 ? (
              <p className="text-sm text-muted-foreground">상태 변경 이력이 없어요</p>
            ) : (
              <ul aria-label="상태 변경 이력" className="divide-y">
                {history.data?.pages
                  .flatMap((page) => page.items)
                  .map((item) => (
                    <li key={item.id} className="flex flex-col gap-2 py-4 text-sm">
                      <p className="font-bold">{historyTitle(item)}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(item.changed_at), 'yyyy. M. d. (EEE) HH:mm', {
                          locale: ko,
                        })}
                      </p>
                      <p>
                        {statusLabel(item.from_status)} → {statusLabel(item.to_status)}
                        {item.caution_tag && (
                          <Badge variant="caution" className="ml-2">
                            주의
                          </Badge>
                        )}
                      </p>
                      {item.reason && (
                        <p className="break-words whitespace-pre-line">사유: {item.reason}</p>
                      )}
                      {(item.reaction_date || item.symptom_note || item.check_note) && (
                        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-button bg-muted p-3">
                          <CautionDetails
                            reactionDate={item.reaction_date}
                            symptom={item.symptom_note}
                            check={item.check_note}
                          />
                        </dl>
                      )}
                      {item.meal_entry_id && (
                        <Link
                          to={`/meals/week?record=${item.meal_entry_id}`}
                          className="self-start text-primary underline"
                        >
                          관련 식단 보기
                        </Link>
                      )}
                    </li>
                  ))}
              </ul>
            )}
            {history.isError && (
              <ErrorBanner
                message="이력을 더 불러오지 못했어요"
                onRetry={() =>
                  void (history.isFetchNextPageError ? history.fetchNextPage() : history.refetch())
                }
              />
            )}
            {history.hasNextPage && (
              <Button
                variant="soft"
                disabled={history.isFetchingNextPage}
                onClick={() => void history.fetchNextPage()}
              >
                이력 더 보기
              </Button>
            )}
          </>
        )}
      </Card>
      <ReasonDialog
        open={clearing}
        onOpenChange={setClearing}
        title={'"주의" 태그를 해제할까요?'}
        description="먹어봄은 그대로예요. 반응 날짜와 증상·확인 메모는 이력에 남아요"
        confirmLabel="해제"
        pending={clearTag.isPending}
        onConfirm={async (reason) => {
          await clearTag.mutateAsync({ id: food.id, reason })
          setClearing(false)
          notifyDone(`${food.name}의 "주의" 태그를 해제했어요`)
        }}
      />
      {child.data && (
        <FoodSheet
          open={sheet.value === food.id}
          initial={food}
          birthDate={child.data.birthDate}
          foods={all.data ?? [food]}
          addTried={false}
          onClose={sheet.close}
          onEditExisting={(id) => {
            void navigate(`/meals/foods/${id}?record=${id}`, { replace: true })
          }}
          onDeleted={() => void navigate('/meals/foods', { replace: true })}
        />
      )}
    </>
  )
}
function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      aria-label={title}
      className="flex min-w-0 flex-col gap-3 rounded-card border bg-surface p-4 md:p-5"
    >
      <h3 className="font-bold">{title}</h3>
      {children}
    </section>
  )
}
function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words whitespace-pre-line">{children}</dd>
    </>
  )
}
function CautionDetails({
  reactionDate,
  symptom,
  check,
}: {
  reactionDate: string | null
  symptom: string | null
  check: string | null
}) {
  return (
    <>
      <Info label="반응 날짜">{reactionDate ? formatDateLabel(reactionDate) : '모름'}</Info>
      <Info label="증상 메모">{symptom || '없음'}</Info>
      <Info label="확인 메모">{check || '없음'}</Info>
    </>
  )
}
function historyTitle(item: FoodStatusHistory) {
  if (item.trigger === 'meal_entry') return '식단 기록으로 먹어봄 전환'
  if (item.trigger === 'revert') return '식단 변경으로 알러지·주의 복원'
  if (item.from_status === item.to_status) return '"주의" 태그 해제'
  return item.to_status === 'caution' ? '알러지·주의 지정' : '알러지·주의 해제'
}
