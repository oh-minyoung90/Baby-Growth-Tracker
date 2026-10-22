import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !publishableKey) {
  throw new Error('Supabase 환경변수가 없습니다. .env.example을 참고해 .env.local을 만들어 주세요.')
}

/**
 * 브라우저용 Supabase 클라이언트. Publishable key만 사용하고 데이터 보호는 DB의 RLS가 맡는다 (기술요구사항서 2.1, 6.1).
 * - 로그인 세션은 브라우저 저장소에 유지하고 자동으로 갱신한다 (D6)
 * - 로그인은 6자리 코드 방식이라 주소창의 링크 토큰은 읽지 않는다
 */
export const supabase = createClient<Database>(url, publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
})
