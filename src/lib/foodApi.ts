import type { PostgrestError } from '@supabase/supabase-js'
import type { Tables } from '@/lib/database.types'
import { dateErrorReason, violatedCheck } from '@/lib/dbErrors'
import {
  isFoodGroup,
  isFoodPreference,
  isFoodStatus,
  type FoodGroup,
  type FoodPreference,
  type FoodStatus,
} from '@/lib/foodTypes'
import { supabase } from '@/lib/supabase'

/** 음식 (F-13, F-14). 상태와 처음 먹은 날은 DB 함수로만 바뀐다 (D10) */
export interface Food {
  id: string
  name: string
  group: FoodGroup
  status: FoodStatus
  /** 먹어봄 음식의 "주의" 태그 (BR-10) */
  cautionTag: boolean
  /** 처음 먹은 날 'YYYY-MM-DD'. 모르면 null */
  firstTriedDate: string | null
  /** "이미 먹어 봤어요"로 표시한 음식 (BR-17) */
  manualTried: boolean
  /** "이미 먹어 봤어요"와 함께 입력한 처음 먹은 날 */
  manualFirstTriedDate: string | null
  preference: FoodPreference | null
  memo: string | null
  /** 알러지·주의: 반응 날짜, 증상 메모 (FR-FOOD-11) */
  reactionDate: string | null
  symptomNote: string | null
}

/** 음식 추가·수정 입력 (FR-FOOD-04~05, R45) */
export interface FoodInput {
  name: string
  group: FoodGroup
  memo: string | null
  /** "이미 먹어 봤어요". 수정할 때 null이면 바꾸지 않는다 (알러지·주의 음식) */
  alreadyTried: boolean | null
  /** 처음 먹은 날 (선택). alreadyTried일 때만 넣는다 */
  firstTriedDate: string | null
}

/** 저장 실패 이유. 화면은 이 값으로 안내 문구와 표시할 입력칸을 고른다 */
export type FoodSaveErrorReason =
  'duplicateName' | 'nameLength' | 'memoLength' | 'futureDate' | 'beforeBirth' | 'network'

export class FoodSaveError extends Error {
  readonly reason: FoodSaveErrorReason

  constructor(reason: FoodSaveErrorReason) {
    super(reason)
    this.reason = reason
  }
}

const COLUMNS =
  'id, name, food_group, status, caution_tag, first_tried_date, manual_tried, manual_first_tried_date, preference, memo, reaction_date, symptom_note'

type Row = Pick<
  Tables<'foods'>,
  | 'id'
  | 'name'
  | 'food_group'
  | 'status'
  | 'caution_tag'
  | 'first_tried_date'
  | 'manual_tried'
  | 'manual_first_tried_date'
  | 'preference'
  | 'memo'
  | 'reaction_date'
  | 'symptom_note'
>

function toFood(row: Row): Food {
  // DB CHECK 제약(T-36)으로 정해진 값만 들어 있다
  if (!isFoodGroup(row.food_group)) throw new Error(`알 수 없는 식품군: ${row.food_group}`)
  if (!isFoodStatus(row.status)) throw new Error(`알 수 없는 음식 상태: ${row.status}`)
  return {
    id: row.id,
    name: row.name,
    group: row.food_group,
    status: row.status,
    cautionTag: row.caution_tag,
    firstTriedDate: row.first_tried_date,
    manualTried: row.manual_tried,
    manualFirstTriedDate: row.manual_first_tried_date,
    preference: isFoodPreference(row.preference) ? row.preference : null,
    memo: row.memo,
    reactionDate: row.reaction_date,
    symptomNote: row.symptom_note,
  }
}

/** CHECK 제약 이름 → 실패 이유 (T-36 마이그레이션) */
const CHECK_REASONS = {
  foods_name_length: 'nameLength',
  foods_memo_length: 'memoLength',
} as const satisfies Record<string, FoodSaveErrorReason>

function toSaveError(error: PostgrestError, input: FoodInput): FoodSaveError {
  const dateReason = input.firstTriedDate ? dateErrorReason(error, input.firstTriedDate) : null
  if (dateReason) return new FoodSaveError(dateReason)
  // 23505: 같은 이름의 음식이 이미 있음 (BR-18)
  if (error.code === '23505') return new FoodSaveError('duplicateName')
  const check = violatedCheck(error, Object.keys(CHECK_REASONS) as (keyof typeof CHECK_REASONS)[])
  return new FoodSaveError(check ? CHECK_REASONS[check] : 'network')
}

/** 함수 인자: null은 보내지 않아 DB 기본값(null)을 쓴다 */
function toArgs(input: FoodInput) {
  return {
    name: input.name,
    food_group: input.group,
    memo: input.memo ?? undefined,
    first_tried_date: input.firstTriedDate ?? undefined,
  }
}

/** 내 음식 전체, 이름 가나다순. RLS로 본인 것만 조회된다 */
export async function fetchFoods(): Promise<Food[]> {
  const { data, error } = await supabase.from('foods').select(COLUMNS)
  if (error) throw error
  return data.map(toFood).sort((a, b) => a.name.localeCompare(b.name, 'ko'))
}

/** 새 음식 (FR-FOOD-04~05). 화면에서 직접 추가할 수 없어 DB 함수로 추가한다 (D10) */
export async function createFood(input: FoodInput): Promise<Food> {
  const { data, error } = await supabase.rpc('add_food', {
    ...toArgs(input),
    already_tried: input.alreadyTried ?? false,
  })
  if (error) throw toSaveError(error, input)
  return toFood(data)
}

/** 음식 수정. "이미 먹어 봤어요"도 함께 바꾸므로 DB 함수로 저장한다 (R45) */
export async function updateFood(id: string, input: FoodInput): Promise<Food> {
  const { data, error } = await supabase.rpc('update_food', {
    ...toArgs(input),
    food_id: id,
    already_tried: input.alreadyTried ?? undefined,
  })
  if (error) throw toSaveError(error, input)
  return toFood(data)
}

/** 음식 삭제. 식단과 레시피에 적힌 이름은 남는다 (FR-FOOD-08, T-39·T-47) */
export async function deleteFood(id: string): Promise<void> {
  const { error } = await supabase.from('foods').delete().eq('id', id)
  if (error) throw error
}

/** 기본 음식 목록(부록 B)을 아직 안 먹어봄으로 추가한다. 같은 이름은 건너뛰고, 추가한 수를 돌려준다 (FR-FOOD-07) */
export async function seedDefaultFoods(): Promise<number> {
  const { data, error } = await supabase.rpc('seed_default_foods')
  if (error) throw error
  return data
}
