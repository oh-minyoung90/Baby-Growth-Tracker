import type { PostgrestError } from '@supabase/supabase-js'
import type { Tables } from '@/lib/database.types'
import { dateErrorReason, violatedCheck } from '@/lib/dbErrors'
import { supabase } from '@/lib/supabase'

/** 키·몸무게 측정 (F-05) */
export interface BodyMeasure {
  id: string
  /** 측정 날짜 'YYYY-MM-DD' */
  date: string
  heightCm: number | null
  weightKg: number | null
  memo: string | null
}

export type BodyMeasureInput = Omit<BodyMeasure, 'id'>

/** 저장 실패 이유. 화면은 이 값으로 안내 문구와 표시할 입력칸을 고른다 */
export type BodySaveErrorReason =
  | 'futureDate'
  | 'beforeBirth'
  | 'duplicateDate'
  | 'heightRange'
  | 'weightRange'
  | 'heightOrWeight'
  | 'memoLength'
  | 'network'

export class BodySaveError extends Error {
  readonly reason: BodySaveErrorReason

  constructor(reason: BodySaveErrorReason) {
    super(reason)
    this.reason = reason
  }
}

const COLUMNS = 'id, date, height_cm, weight_kg, memo'

type Row = Pick<Tables<'body_measures'>, 'id' | 'date' | 'height_cm' | 'weight_kg' | 'memo'>

function toMeasure(row: Row): BodyMeasure {
  return {
    id: row.id,
    date: row.date,
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    memo: row.memo,
  }
}

function toRow(input: BodyMeasureInput) {
  return {
    date: input.date,
    height_cm: input.heightCm,
    weight_kg: input.weightKg,
    memo: input.memo,
  }
}

/** CHECK 제약 이름 → 실패 이유 (T-15 마이그레이션) */
const CHECK_REASONS = {
  body_measures_height_range: 'heightRange',
  body_measures_weight_range: 'weightRange',
  body_measures_height_or_weight: 'heightOrWeight',
  body_measures_memo_length: 'memoLength',
} as const satisfies Record<string, BodySaveErrorReason>

function toSaveError(error: PostgrestError, input: BodyMeasureInput): BodySaveError {
  const dateReason = dateErrorReason(error, input.date)
  if (dateReason) return new BodySaveError(dateReason)
  // 23505: 같은 날짜에 이미 기록이 있음 (측정 날짜당 1건, FR-BODY-06)
  if (error.code === '23505') return new BodySaveError('duplicateDate')
  const check = violatedCheck(error, Object.keys(CHECK_REASONS) as (keyof typeof CHECK_REASONS)[])
  return new BodySaveError(check ? CHECK_REASONS[check] : 'network')
}

/** 측정 기록 전체, 측정 날짜 최신순 (FR-BODY-05). RLS로 본인 것만 조회된다 */
export async function fetchBodyMeasures(): Promise<BodyMeasure[]> {
  const { data, error } = await supabase
    .from('body_measures')
    .select(COLUMNS)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map(toMeasure)
}

/** 새 측정 기록. owner_id는 DB 기본값(로그인한 사용자)으로 채워진다 */
export async function createBodyMeasure(input: BodyMeasureInput): Promise<BodyMeasure> {
  const { data, error } = await supabase
    .from('body_measures')
    .insert(toRow(input))
    .select(COLUMNS)
    .single()
  if (error) throw toSaveError(error, input)
  return toMeasure(data)
}

export async function updateBodyMeasure(id: string, input: BodyMeasureInput): Promise<BodyMeasure> {
  const { data, error } = await supabase
    .from('body_measures')
    .update(toRow(input))
    .eq('id', id)
    .select(COLUMNS)
    .single()
  if (error) throw toSaveError(error, input)
  return toMeasure(data)
}

export async function deleteBodyMeasure(id: string): Promise<void> {
  const { error } = await supabase.from('body_measures').delete().eq('id', id)
  if (error) throw error
}
