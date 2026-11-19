import { test } from '@playwright/test'
import { exerciseTimelineLayout } from './timelineLayout.ts'

for (const width of [320, 393, 768, 1440]) {
  test.describe(`성장 ${width}px`, () => {
    test.use({ viewport: { width, height: 852 }, isMobile: width < 768, hasTouch: width < 768 })
    for (const mode of ['light', 'dark'] as const) {
      test(`성장 ${mode}: 카드 통합·기간 유지·노란 음식 아이콘·측정 탭`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: mode })
        await exerciseTimelineLayout(page)
      })
    }
  })
}
