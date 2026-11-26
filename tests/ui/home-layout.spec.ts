import { expect, test } from '@playwright/test'
import { exerciseHomeLayout, prepareHomePage } from './homeLayout.ts'

for (const width of [320, 375, 393, 430, 768, 1440]) {
  test.describe(`홈 ${width}px`, () => {
    test.use({ viewport: { width, height: 852 }, isMobile: width < 768, hasTouch: width < 768 })
    for (const mode of ['light', 'dark'] as const) {
      test(`${mode}: 카드 순서·헤더·값 크기·추가·수정 연결`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: mode })
        await exerciseHomeLayout(page)
      })
    }
    if (width === 393) {
      test('준비 탭을 표시하면 홈 헤더에서 설정을 연다', async ({ page }) => {
        await prepareHomePage(page)
        const nav = page.getByRole('navigation', { name: '주 메뉴' })
        await nav.getByRole('link', { name: '설정' }).click()
        await page.getByRole('switch', { name: '하단 메뉴에 준비 목록 표시' }).click()
        await nav.getByRole('link', { name: '홈' }).click()
        await expect(nav.getByRole('link', { name: '준비' })).toBeVisible()
        const settings = page.locator('main header').getByRole('link', { name: '설정' })
        await settings.click()
        await expect(page.getByRole('heading', { name: '설정', exact: true })).toBeVisible()
      })
    }
    if (width === 320 || width === 1440) {
      test('일부 식단: 남은 끼니 추가와 홈 복귀', async ({ page }) => {
        await exerciseHomeLayout(page, false, true)
      })
      test('빈 홈: 카드·기록 연결·성장 메뉴 유지', async ({ page }) => {
        await exerciseHomeLayout(page, true)
      })
    }
  })
}
