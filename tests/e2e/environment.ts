import { loadEnv } from 'vite'

/** 브라우저와 Node 준비 코드가 반드시 같은 dev 프로젝트를 바라보게 한다. */
export function e2eEnvironment() {
  if (process.env.CI) throw new Error('E2E는 테스트 계정이 있는 로컬 PC에서만 실행합니다.')
  const env = loadEnv('test', process.cwd(), '')
  for (const name of [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    'TEST_USER_A_EMAIL',
    'TEST_USER_A_PASSWORD',
    'E2E_DEV_PROJECT_REF',
  ]) {
    if (!env[name]) throw new Error(`${name}: .env.local과 .env.test.local을 확인하세요.`)
  }
  const url = new URL(env.VITE_SUPABASE_URL)
  if (
    url.origin !== `https://${env.E2E_DEV_PROJECT_REF}.supabase.co` ||
    !env.VITE_SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_')
  ) {
    throw new Error('E2E_DEV_PROJECT_REF로 지정한 dev 프로젝트와 공개 키만 사용할 수 있습니다.')
  }
  return env
}
