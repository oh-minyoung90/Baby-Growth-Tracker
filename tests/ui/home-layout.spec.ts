import { test } from '@playwright/test'
import { exerciseHomeLayout } from './homeLayout.ts'

for (const width of [320, 375, 393, 430, 768, 1440]) {
  test.describe(`홈 ${width}px`, () => {
    test.use({ viewport: { width, height: 852 }, isMobile: width < 768, hasTouch: width < 768 })
    for (const mode of ['light', 'dark'] as const) {
      test(`${mode}: 카드 순서·헤더·값 크기·빠른 기록·성장 메뉴`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: mode })
        await exerciseHomeLayout(page)
      })
    }
    if (width === 320 || width === 1440) {
      test('빈 홈: 카드·기록 연결·성장 메뉴 유지', async ({ page }) => {
        await exerciseHomeLayout(page, true)
      })
    }
  })
}
