import { test } from '@playwright/test'
import { exerciseSleepLayout } from './sleepLayout.ts'

for (const width of [320, 375, 393, 430, 768, 1440]) {
  test.describe(`${width}px`, () => {
    test.use({
      viewport: { width, height: 852 },
      isMobile: width < 768,
      hasTouch: width < 768,
    })
    for (const mode of ['light', 'dark'] as const) {
      test(`수면 입력 ${mode}: 빈 값·입력·낮잠·오류의 넘침/겹침 검사`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: mode })
        await exerciseSleepLayout(page)
      })
    }
  })
}
