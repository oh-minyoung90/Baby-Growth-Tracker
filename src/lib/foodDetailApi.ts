import type { Tables } from './database.types'
import { isMealIntake, isMealType, type MealIntake, type MealType } from './mealTypes'
import { supabase } from './supabase'

export interface FoodEatenMeal {
  id: string
  date: string
  type: MealType
  intake: MealIntake | null
}
export type FoodStatusHistory = Pick<
  Tables<'food_status_history'>,
  | 'id'
  | 'changed_at'
  | 'from_status'
  | 'to_status'
  | 'caution_tag'
  | 'trigger'
  | 'reason'
  | 'meal_entry_id'
  | 'reaction_date'
  | 'symptom_note'
  | 'check_note'
>
export interface FoodDetailPage<T> {
  items: T[]
  nextOffset: number | undefined
}
const PAGE_SIZE = 20
function pageOf<T>(rows: T[], offset: number): FoodDetailPage<T> {
  return {
    items: rows.slice(0, PAGE_SIZE),
    nextOffset: rows.length > PAGE_SIZE ? offset + PAGE_SIZE : undefined,
  }
}

/** DB에서 집계해 목록 조회의 행 수 제한을 받지 않는다. */
export async function fetchFoodMealCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc('food_meal_counts')
  if (error) throw error
  return Object.fromEntries(data.map((row) => [row.food_id, row.eaten_count]))
}

/** 직접 선택한 음식만 조회한다. 계획과 레시피 재료는 포함하지 않는다 (BR-15)。 */
export async function fetchFoodEatenMeals(
  foodId: string,
  offset = 0,
): Promise<FoodDetailPage<FoodEatenMeal>> {
  const { data, error } = await supabase
    .from('meal_entries')
    .select('id, date, meal_type, intake, meal_entry_foods!inner(food_id)')
    .eq('eaten', true)
    .eq('meal_entry_foods.food_id', foodId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id')
    .range(offset, offset + PAGE_SIZE)
  if (error) throw error
  return pageOf(
    data.map((row) => {
      if (!isMealType(row.meal_type)) throw new Error('식단의 끼니 값이 올바르지 않습니다')
      return {
        id: row.id,
        date: row.date,
        type: row.meal_type,
        intake: isMealIntake(row.intake) ? row.intake : null,
      }
    }),
    offset,
  )
}

export async function fetchFoodStatusHistory(
  foodId: string,
  offset = 0,
): Promise<FoodDetailPage<FoodStatusHistory>> {
  const { data, error } = await supabase
    .from('food_status_history')
    .select(
      'id, changed_at, from_status, to_status, caution_tag, trigger, reason, meal_entry_id, reaction_date, symptom_note, check_note',
    )
    .eq('food_id', foodId)
    .order('changed_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + PAGE_SIZE)
  if (error) throw error
  return pageOf(data, offset)
}
