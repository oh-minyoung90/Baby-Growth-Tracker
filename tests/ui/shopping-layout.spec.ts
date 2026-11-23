import { test } from '@playwright/test'
import { exerciseShoppingLayout } from './shoppingLayout.ts'
for (const width of [320, 393, 768, 1440]) {
  test.describe(`쇼핑 ${width}px`, () => {
    test.use({ viewport: { width, height: 852 }, isMobile: width < 768, hasTouch: width < 768 })
    for (const mode of ['light', 'dark'] as const)
      test(`${mode}: 카테고리·긴 이름·입력·선택 메뉴`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: mode })
        await exerciseShoppingLayout(page)
      })
  })
}
