import { withObjectParticle } from '@/domain/josa'
import type { MealSaveResult } from './mealApi'
import { notifyDone, notifySaved } from './notify'

/** 서버가 반환한 실제 첫 시도만 알린다. 타임라인은 음식의 첫 시도 날짜에서 계산한다. */
export function notifyMealSaved(result: MealSaveResult): void {
  if (result.firstTriedFoods.length === 0) {
    notifySaved()
    return
  }
  const names = result.firstTriedFoods.map((food) => food.name).join(', ')
  notifyDone(`${withObjectParticle(names)} 처음 먹었어요. 타임라인에 남겼어요`)
}
