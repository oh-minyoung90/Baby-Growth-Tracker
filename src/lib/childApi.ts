import { supabase } from '@/lib/supabase'

/** 아이 정보 (F-01). 계정당 1건 (FR-CHILD-04) */
export interface Child {
  id: string
  nickname: string
  /** 'YYYY-MM-DD' */
  birthDate: string
}

export interface ChildInput {
  nickname: string
  birthDate: string
}

/** 저장 실패 이유. 화면은 이 값으로 안내 문구를 고른다 */
export class ChildSaveError extends Error {
  readonly reason: 'futureDate' | 'invalid' | 'network'

  constructor(reason: 'futureDate' | 'invalid' | 'network') {
    super(reason)
    this.reason = reason
  }
}

/** 로그인한 사용자의 아이 정보. 없으면 null (RLS로 본인 것만 조회된다) */
export async function fetchMyChild(): Promise<Child | null> {
  const { data, error } = await supabase
    .from('children')
    .select('id, nickname, birth_date')
    .maybeSingle()
  if (error) throw error
  return data && { id: data.id, nickname: data.nickname, birthDate: data.birth_date }
}

/** 아이 정보를 등록하거나 수정한다 (계정당 1건이라 owner_id 기준으로 덮어쓴다) */
export async function saveChild(ownerId: string, input: ChildInput): Promise<Child> {
  const { data, error } = await supabase
    .from('children')
    .upsert(
      { owner_id: ownerId, nickname: input.nickname.trim(), birth_date: input.birthDate },
      { onConflict: 'owner_id' },
    )
    .select('id, nickname, birth_date')
    .single()
  if (error) {
    // DB 검증(T-08): 22007 미래 날짜, 23514 이름 길이
    if (error.code === '22007') throw new ChildSaveError('futureDate')
    if (error.code === '23514') throw new ChildSaveError('invalid')
    throw new ChildSaveError('network')
  }
  return { id: data.id, nickname: data.nickname, birthDate: data.birth_date }
}
