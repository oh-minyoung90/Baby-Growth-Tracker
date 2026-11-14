import { defineConfig } from '@playwright/test'
import { e2eEnvironment } from './tests/e2e/environment.ts'

const env = e2eEnvironment()
// macOS 13에서는 최신 번들 브라우저 대신 설치된 Chrome을 사용할 수 있다.
const channel = process.env.E2E_CHROME === '1' ? 'chrome' : undefined
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: 'list',
  outputDir: 'test-results',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    timezoneId: 'Asia/Seoul',
    locale: 'ko-KR',
    reducedMotion: 'reduce',
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
    // 세션·아이 정보가 자동으로 기록되지 않게 한다.
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    channel,
  },
  projects: [
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 } } },
    {
      name: 'mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'ignore',
    env: {
      VITE_SUPABASE_URL: env.VITE_SUPABASE_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  },
})
