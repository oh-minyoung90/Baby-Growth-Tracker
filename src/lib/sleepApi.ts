import type { PostgrestError } from '@supabase/supabase-js'
import type { Json, Tables } from '@/lib/database.types'
import { dateErrorReason, violatedCheck } from '@/lib/dbErrors'
import { supabase } from '@/lib/supabase'

/** 낮잠 하나. 날짜를 붙인 시각 'YYYY-MM-DDTHH:MM' (BR-05~06) */
export interface Nap {
  startAt: string
  endAt: string
}

/** 수면 기록 (F-10). 수면일당 1건 (FR-SLEEP-08) */
export interface SleepLog {
  id: string
  /** 수면일: 밤잠에 든 날 'YYYY-MM-DD' (BR-04) */
  date: string
  /** 날짜를 붙인 잠든 시각 'YYYY-MM-DDTHH:MM' */
  bedAt: string | null
  /** 날짜를 붙인 일어난 시각 'YYYY-MM-DDTHH:MM' */
  wakeAt: string | null
  naps: Nap[]
  memo: string | null
}

export type SleepLogInput = Omit<SleepLog, 'id'>

/** 저장 실패 이유. 화면은 이 값으로 안내 문구와 표시할 입력칸을 고른다 */
export type SleepSaveErrorReason =
  'futureDate' | 'beforeBirth' | 'duplicateDate' | 'memoLength' | 'network'

export class SleepSaveError extends Error {
  readonly reason: SleepSaveErrorReason

  constructor(reason: SleepSaveErrorReason) {
    super(reason)
    this.reason = reason
  }
}

const COLUMNS = 'id, date, bed_time, wake_time, naps, memo'

type Row = Pick<Tables<'sleep_logs'>, 'id' | 'date' | 'bed_time' | 'wake_time' | 'naps' | 'memo'>

/** DB의 timestamp('2026-10-19T21:30:00')에서 초를 뺀다 */
function toMinute(value: string): string {
  return value.slice(0, 16)
}

function isNapJson(value: Json): value is { start: string; end: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof value.start === 'string' &&
    typeof value.end === 'string'
  )
}

function toSleepLog(row: Row): SleepLog {
  // DB 검증 트리거(T-24)로 [{start, end}] 배열만 들어 있다
  const naps = Array.isArray(row.naps) ? row.naps.filter(isNapJson) : []
  return {
    id: row.id,
    date: row.date,
    bedAt: row.bed_time && toMinute(row.bed_time),
    wakeAt: row.wake_time && toMinute(row.wake_time),
    naps: naps.map((nap) => ({ startAt: toMinute(nap.start), endAt: toMinute(nap.end) })),
    memo: row.memo,
  }
}

function toRow(input: SleepLogInput) {
  return {
    date: input.date,
    bed_time: input.bedAt,
    wake_time: input.wakeAt,
    naps: input.naps.map((nap) => ({ start: nap.startAt, end: nap.endAt })),
    memo: input.memo,
  }
}

function toSaveError(error: PostgrestError, input: SleepLogInput): SleepSaveError {
  const dateReason = dateErrorReason(error, input.date)
  if (dateReason) return new SleepSaveError(dateReason)
  // 23505: 같은 수면일에 기록이 이미 있음 (unique (owner_id, date), FR-SLEEP-08)
  if (error.code === '23505') return new SleepSaveError('duplicateDate')
  if (violatedCheck(error, ['sleep_logs_memo_length'])) return new SleepSaveError('memoLength')
  // 시간 검증 트리거(FR-SLEEP-07)는 화면에서 같은 규칙으로 먼저 막는다
  return new SleepSaveError('network')
}

/** 내 수면 기록 전체. 수면일 최신순 (FR-SLEEP-09) */
export async function fetchSleepLogs(): Promise<SleepLog[]> {
  const { data, error } = await supabase
    .from('sleep_logs')
    .select(COLUMNS)
    .order('date', { ascending: false })
  if (error) throw error
  return data.map(toSleepLog)
}

/** 새 수면 기록. owner_id는 DB 기본값(로그인한 사용자)으로 채워진다 */
export async function createSleepLog(input: SleepLogInput): Promise<SleepLog> {
  const { data, error } = await supabase
    .from('sleep_logs')
    .insert(toRow(input))
    .select(COLUMNS)
    .single()
  if (error) throw toSaveError(error, input)
  return toSleepLog(data)
}

export async function updateSleepLog(id: string, input: SleepLogInput): Promise<SleepLog> {
  const { data, error } = await supabase
    .from('sleep_logs')
    .update(toRow(input))
    .eq('id', id)
    .select(COLUMNS)
    .single()
  if (error) throw toSaveError(error, input)
  return toSleepLog(data)
}

export async function deleteSleepLog(id: string): Promise<void> {
  const { error } = await supabase.from('sleep_logs').delete().eq('id', id)
  if (error) throw error
}
