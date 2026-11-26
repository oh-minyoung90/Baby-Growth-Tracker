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
      test('홈과 아이 정보에서 설정을 열고 기본 탭에는 설정 버튼을 표시하지 않는다', async ({
        page,
      }) => {
        await prepareHomePage(page)
        const nav = page.getByRole('navigation', { name: '주 메뉴' })
        await expect(nav.getByRole('link', { name: '준비' })).toBeVisible()
        const settings = page.locator('main header').getByRole('link', { name: '설정' })
        await settings.click()
        await expect(page.getByRole('heading', { name: '설정', exact: true })).toBeVisible()
        for (const [tab, title] of [
          ['식사', '식사'],
          ['성장', '성장'],
          ['수면', '수면'],
          ['준비', '준비 목록'],
        ]) {
          await nav.getByRole('link', { name: tab, exact: true }).click()
          await expect(
            page.getByRole('heading', { level: 1, name: title, exact: true }),
          ).toBeVisible()
          await expect(settings).toHaveCount(0)
        }
        await nav.getByRole('link', { name: '홈' }).click()
        const profile = page.getByRole('link', { name: '아이 프로필 사진 편집' })
        await profile.click()
        const home = page.locator('main header').getByRole('link', { name: '홈으로' })
        const title = page.getByRole('heading', { level: 1, name: '아이 정보' })
        await expect(title).toBeVisible()
        await expect(home).toBeVisible()
        const [homeBox, settingsBox, titleBox] = await Promise.all([
          home.boundingBox(),
          settings.boundingBox(),
          title.boundingBox(),
        ])
        expect(homeBox!.y).toBeCloseTo(settingsBox!.y)
        expect(titleBox!.y).toBeGreaterThan(homeBox!.y + homeBox!.height)
        await home.click()
        await profile.click()
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
