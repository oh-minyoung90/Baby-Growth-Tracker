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

/** 필요한 주만 조회한다. 본인 데이터 접근은 RLS가 제한한다. */
export async function fetchMealWeek(start: string, end: string): Promise<MealEntry[]> {
  const { data, error } = await supabase
    .from('meal_entries')
    .select(
      'id, date, meal_type, eaten, intake, memo, meal_entry_foods(food_id, food_name, position), meal_entry_recipes(recipe_id, recipe_name, position)',
    )
    .gte('date', start)
    .lte('date', end)
    .order('date')
  if (error) throw error
  return data.map((row) => {
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
  })
}
