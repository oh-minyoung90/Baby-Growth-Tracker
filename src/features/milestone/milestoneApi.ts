import type { PostgrestError } from '@supabase/supabase-js'
import type { Tables } from '@/lib/database.types'
import { dateErrorReason, violatedCheck } from '@/lib/dbErrors'
import { isMilestoneType, type MilestoneType } from '@/lib/milestoneTypes'
import { supabase } from '@/lib/supabase'

/** 발달 기록 (F-06) */
export interface Milestone {
  id: string
  type: MilestoneType
  /** 기록 날짜 'YYYY-MM-DD' */
  date: string
  /** 내용 (30자) */
  title: string
  memo: string | null
}

export type MilestoneInput = Omit<Milestone, 'id'>

/** 저장 실패 이유. 화면은 이 값으로 안내 문구와 표시할 입력칸을 고른다 */
export type MilestoneSaveErrorReason =
  'futureDate' | 'beforeBirth' | 'titleLength' | 'memoLength' | 'network'

export class MilestoneSaveError extends Error {
  readonly reason: MilestoneSaveErrorReason

  constructor(reason: MilestoneSaveErrorReason) {
    super(reason)
    this.reason = reason
  }
}

const COLUMNS = 'id, type, date, title, memo'

type Row = Pick<Tables<'milestones'>, 'id' | 'type' | 'date' | 'title' | 'memo'>

function toMilestone(row: Row): Milestone {
  // DB CHECK 제약(T-18)으로 네 유형만 들어 있다
  if (!isMilestoneType(row.type)) throw new Error(`알 수 없는 발달 기록 유형: ${row.type}`)
  return { id: row.id, type: row.type, date: row.date, title: row.title, memo: row.memo }
}

/** CHECK 제약 이름 → 실패 이유 (T-18 마이그레이션) */
const CHECK_REASONS = {
  milestones_title_length: 'titleLength',
  milestones_memo_length: 'memoLength',
} as const satisfies Record<string, MilestoneSaveErrorReason>

function toSaveError(error: PostgrestError, input: MilestoneInput): MilestoneSaveError {
  const dateReason = dateErrorReason(error, input.date)
  if (dateReason) return new MilestoneSaveError(dateReason)
  const check = violatedCheck(error, Object.keys(CHECK_REASONS) as (keyof typeof CHECK_REASONS)[])
  return new MilestoneSaveError(check ? CHECK_REASONS[check] : 'network')
}

/** 내 발달 기록 전체. 날짜 최신순, 같은 날짜는 나중에 저장한 기록이 먼저 */
export async function fetchMilestones(): Promise<Milestone[]> {
  const { data, error } = await supabase
    .from('milestones')
    .select(COLUMNS)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map(toMilestone)
}

/** 기록 하나. 없거나 다른 사람의 기록이면(RLS) null */
export async function fetchMilestone(id: string): Promise<Milestone | null> {
  const { data, error } = await supabase
    .from('milestones')
    .select(COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data && toMilestone(data)
}

/** 새 발달 기록. owner_id는 DB 기본값(로그인한 사용자)으로 채워진다 */
export async function createMilestone(input: MilestoneInput): Promise<Milestone> {
  const { data, error } = await supabase.from('milestones').insert(input).select(COLUMNS).single()
  if (error) throw toSaveError(error, input)
  return toMilestone(data)
}

export async function updateMilestone(id: string, input: MilestoneInput): Promise<Milestone> {
  const { data, error } = await supabase
    .from('milestones')
    .update(input)
    .eq('id', id)
    .select(COLUMNS)
    .single()
  if (error) throw toSaveError(error, input)
  return toMilestone(data)
}

export async function deleteMilestone(id: string): Promise<void> {
  const { error } = await supabase.from('milestones').delete().eq('id', id)
  if (error) throw error
}
