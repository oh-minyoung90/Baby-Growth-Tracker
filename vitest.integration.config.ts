import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// 통합 테스트: 실제 dev Supabase 프로젝트에 테스트 계정 A·B로 접속한다 (기술요구사항서 9.1.1, 9.4).
// .env.local(접속 정보)과 .env.test.local(테스트 계정)을 읽으므로 로컬에서만 실행하고, CI에서는 실행하지 않는다.
export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    environment: 'node',
    env: loadEnv('test', process.cwd(), ''),
    // 같은 테스트 계정 데이터를 다루므로 파일을 하나씩 순서대로 실행한다
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
})
