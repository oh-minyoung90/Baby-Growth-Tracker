import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // import '@/lib/utils' → src/lib/utils
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    // 브라우저 대신 jsdom에서 컴포넌트를 렌더링한다
    environment: 'jsdom',
    // 단위·컴포넌트 테스트가 실제 Supabase(.env.local)에 접속하지 않도록 가짜 주소를 넣는다.
    // 실제 DB를 쓰는 테스트는 npm run test:integration (vitest.integration.config.ts)
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:1',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_unit_test',
    },
    setupFiles: ['./src/test/setup.ts'],
    // 단위·컴포넌트 테스트만 실행한다. E2E(tests/e2e)는 Playwright로 따로 실행한다 (T-32)
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx'],
    },
  },
})
