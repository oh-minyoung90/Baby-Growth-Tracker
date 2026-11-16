import { defineConfig } from '@playwright/test'

// 실제 DB·로그인 없이 CI에서도 화면 레이아웃을 검사한다.
export default defineConfig({
  testDir: './tests/ui',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 30_000,
  reporter: 'list',
  outputDir: 'test-results/ui',
  use: {
    baseURL: 'http://127.0.0.1:4180',
    viewport: { width: 393, height: 852 },
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    reducedMotion: 'reduce',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        channel: process.env.E2E_CHROME === '1' ? 'chrome' : undefined,
      },
    },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4180 --strictPort',
    url: 'http://127.0.0.1:4180',
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'ignore',
    env: {
      VITE_SUPABASE_URL: 'https://ui-fixture.supabase.test',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_ui_fixture',
    },
  },
})
