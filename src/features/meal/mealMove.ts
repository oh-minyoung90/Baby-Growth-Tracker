import { formatDateLabel } from '@/domain/date'
import { MealSaveError, type MealMoveTarget } from '@/lib/mealApi'
import { mealTypeLabel } from '@/lib/mealTypes'

export const FUTURE_MOVE_TITLE = '먹음 체크를 해제하고 옮길까요?'
export function futureMoveDescription(target: MealMoveTarget) {
  return `${formatDateLabel(target.date)} ${mealTypeLabel(target.type)}은 계획으로 저장돼요. 음식 상태와 처음 먹은 날도 다시 계산돼요.`
}
export function mealMoveError(error: unknown): string {
  if (error instanceof MealSaveError) {
    if (error.reason === 'beforeBirth') return '생년월일 이전 날짜는 고를 수 없어요'
    if (error.reason === 'duplicate') return '그 끼니에는 이미 기록이 있어요'
    if (error.reason === 'notFound') return '식단을 찾을 수 없어요. 목록을 다시 확인해 주세요'
    if (error.reason === 'futureDate')
      return '날짜를 다시 확인해 주세요. 내일 이후에는 먹음 체크를 해제해야 해요'
  }
  return '식단을 옮기지 못했어요. 다시 시도해 주세요'
}

export function mealCopyError(error: unknown): string {
  if (error instanceof MealSaveError) {
    if (error.reason === 'duplicate') return '그 끼니에는 이미 기록이 있어요'
    if (error.reason === 'beforeBirth') return '생년월일 이전 날짜는 고를 수 없어요'
    if (error.reason === 'notFound') return '복사할 원본 식단을 찾을 수 없어요'
    if (error.reason === 'staleItem')
      return '음식이나 레시피가 바뀌었어요. 창을 닫고 원본 식단을 다시 확인해 주세요'
  }
  return '식단을 복사하지 못했어요. 다시 시도해 주세요'
}
