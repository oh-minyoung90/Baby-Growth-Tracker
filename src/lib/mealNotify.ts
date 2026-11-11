import { withObjectParticle } from '@/domain/josa'
import type { MealSaveResult } from './mealApi'
import { notifyDone, notifySaved } from './notify'

/** 타임라인 연결(T-51) 전에는 실제 완료된 첫 시도 기록만 안내한다. */
export function notifyMealSaved(result: MealSaveResult): void {
  if (result.firstTriedFoods.length === 0) {
    notifySaved()
    return
  }
  const names = result.firstTriedFoods.map((food) => food.name).join(', ')
  notifyDone(`${withObjectParticle(names)} 처음 먹었어요`)
}
