import type { PostgrestError, QueryData } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { isMealIntake, isMealType, type MealIntake, type MealType } from './mealTypes'

/** ID가 null인 항목은 삭제된 음식·레시피다. 저장 당시 이름으로 계속 표시한다 (D7). */
export interface MealItem {
  id: string | null
  name: string
}
export interface MealEntry {
  id: string
  date: string
  type: MealType
  eaten: boolean
  intake: MealIntake | null
  memo: string | null
  foods: MealItem[]
  recipes: MealItem[]
}

export type MealInput = Omit<MealEntry, 'id'>
export interface MealSaveResult {
  id: string
  firstTriedFoods: { id: string; name: string }[]
}
export type MealSaveErrorReason =
  'duplicate' | 'futureDate' | 'memoLength' | 'selection' | 'staleItem' | 'notFound' | 'network'
export class MealSaveError extends Error {
  readonly reason: MealSaveErrorReason
  constructor(reason: MealSaveErrorReason) {
    super(reason)
    this.reason = reason
  }
}

const selectMeals = () =>
  supabase
    .from('meal_entries')
    .select(
      'id, date, meal_type, eaten, intake, memo, meal_entry_foods(food_id, food_name, position), meal_entry_recipes(recipe_id, recipe_name, position)',
    )
type MealRow = QueryData<ReturnType<typeof selectMeals>>[number]
function toMeal(row: MealRow): MealEntry {
  if (!isMealType(row.meal_type)) throw new Error('식단의 끼니 값이 올바르지 않습니다')
  return {
    id: row.id,
    date: row.date,
    type: row.meal_type,
    eaten: row.eaten,
    intake: isMealIntake(row.intake) ? row.intake : null,
    memo: row.memo,
    foods: [...row.meal_entry_foods]
      .sort((a, b) => a.position - b.position)
      .map((item) => ({ id: item.food_id, name: item.food_name })),
    recipes: [...row.meal_entry_recipes]
      .sort((a, b) => a.position - b.position)
      .map((item) => ({ id: item.recipe_id, name: item.recipe_name })),
  }
}

/** 필요한 주만 조회한다. 본인 데이터 접근은 RLS가 제한한다. */
export async function fetchMealWeek(start: string, end: string): Promise<MealEntry[]> {
  const { data, error } = await selectMeals().gte('date', start).lte('date', end).order('date')
  if (error) throw error
  return data.map(toMeal)
}

/** 조회 중인 주 바깥의 기록도 ID 주소로 직접 열 수 있게 한 건을 조회한다. */
export async function fetchMealEntry(id: string): Promise<MealEntry | null> {
  const { data, error } = await selectMeals().eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toMeal(data) : null
}

function toSaveError(error: PostgrestError): MealSaveError {
  if (error.code === '23505') return new MealSaveError('duplicate')
  if (error.code === '22007') return new MealSaveError('futureDate')
  if (error.code === '23503') return new MealSaveError('staleItem')
  if (error.code === 'P0002') return new MealSaveError('notFound')
  if (error.code === '22023') return new MealSaveError('selection')
  if (error.code === '23514' && error.message.includes('meal_entries_memo_length'))
    return new MealSaveError('memoLength')
  return new MealSaveError('network')
}

/** 칸 저장과 상태 재계산은 T-40 RPC 한 번으로 처리한다. 빈 메모·ID도 명시적으로 보낸다. */
export async function saveMealEntry(input: MealInput, id?: string): Promise<MealSaveResult> {
  const { data, error } = await supabase.rpc('save_meal_entry', {
    id,
    date: input.date,
    meal_type: input.type,
    eaten: input.eaten,
    foods: input.foods.map((item) => ({ food_id: item.id, food_name: item.name })),
    recipes: input.recipes.map((item) => ({ recipe_id: item.id, recipe_name: item.name })),
    intake: input.intake ?? undefined,
    memo: input.memo ?? undefined,
  })
  if (error) throw toSaveError(error)
  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data) ||
    typeof data.id !== 'string' ||
    !Array.isArray(data.first_tried_foods)
  )
    throw new MealSaveError('network')
  const firstTriedFoods = data.first_tried_foods.map((item) => {
    if (
      !item ||
      typeof item !== 'object' ||
      Array.isArray(item) ||
      typeof item.id !== 'string' ||
      typeof item.name !== 'string'
    )
      throw new MealSaveError('network')
    return { id: item.id, name: item.name }
  })
  return { id: data.id, firstTriedFoods }
}

export async function deleteMealEntry(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_meal_entry', { id })
  if (error) throw toSaveError(error)
}
