import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../src/lib/database.types'

export type TestUser = 'A' | 'B'

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} 환경변수가 없습니다. .env.local과 .env.test.local을 확인하세요.`)
  }
  return value
}

/** 로그인하지 않은 클라이언트 (anon 역할) */
export function createAnonClient(): SupabaseClient<Database> {
  return createClient<Database>(
    required('VITE_SUPABASE_URL'),
    required('VITE_SUPABASE_PUBLISHABLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

/** 테스트 계정으로 비밀번호 로그인한 클라이언트 (기술요구사항서 D3) */
export async function createUserClient(
  user: TestUser,
): Promise<{ client: SupabaseClient<Database>; userId: string }> {
  const client = createAnonClient()
  const { data, error } = await client.auth.signInWithPassword({
    email: required(`TEST_USER_${user}_EMAIL`),
    password: required(`TEST_USER_${user}_PASSWORD`),
  })
  if (error || !data.user) {
    throw new Error(`테스트 계정 ${user} 로그인 실패: ${error?.message ?? '사용자 정보 없음'}`)
  }
  return { client, userId: data.user.id }
}

/** 오늘(UTC)에서 days만큼 더한 날짜 (YYYY-MM-DD) */
export function utcDate(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** 테스트 계정의 아이 정보를 준비한다 (생년월일 이전 날짜 검증용). 이미 있으면 생년월일만 맞춘다. */
export async function ensureChild(
  client: SupabaseClient<Database>,
  userId: string,
  birthDate = '2026-01-08',
): Promise<void> {
  const { error } = await client
    .from('children')
    .upsert(
      { owner_id: userId, nickname: '테스트아기', birth_date: birthDate },
      { onConflict: 'owner_id' },
    )
  if (error) throw error
}
