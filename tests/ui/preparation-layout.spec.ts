import { test } from '@playwright/test'
import { exercisePreparationLayout } from './preparationLayout.ts'
for (const width of [320, 393, 768, 1440]) {
  test.describe(`준비 목록 ${width}px`, () => {
    test.use({ viewport: { width, height: 852 }, isMobile: width < 768, hasTouch: width < 768 })
    for (const mode of ['light', 'dark'] as const)
      test(`${mode}: 긴 할 일·날짜·탭 이동·입력 화면`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: mode })
        await exercisePreparationLayout(page)
      })
  })
}
