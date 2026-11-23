import assert from 'node:assert/strict'
import type { Page } from '@playwright/test'
import { fixtureChild, prepareFixturePage } from './fixture.ts'
export async function exerciseShoppingLayout(page: Page) {
  const stamp = { created_at: '2026-11-23T01:00:00Z', updated_at: '2026-11-23T01:00:00Z' }
  const items = [
    {
      id: 'shopping-book',
      name: '아기와 함께 읽을 긴 제목의 그림책'.repeat(3),
      category: 'books',
      url: 'https://example.com/books',
      memo: '보드북 · 표지가 튼튼한 책을 고르기',
      is_frequent: true,
      status: 'saved',
      ...stamp,
    },
    {
      id: 'shopping-food',
      name: '플레인 요거트',
      category: 'food',
      url: null,
      memo: null,
      is_frequent: true,
      status: 'pending',
      ...stamp,
    },
  ]
  await prepareFixturePage(page, '/shopping?tab=frequent', {
    '/rest/v1/children': fixtureChild,
    '/rest/v1/shopping_items': items,
  })
  await page.getByRole('link', { name: /아기와 함께/ }).waitFor()
  const filters = page.getByRole('radiogroup', { name: '카테고리', exact: true })
  assert.deepEqual(await filters.getByRole('radio').allTextContents(), [
    '전체',
    '음식',
    '의류',
    '생활용품',
    '장난감',
    '도서',
    '기타',
  ])
  await filters.getByRole('radio', { name: '장난감', exact: true }).click()
  await page.getByText('이 카테고리에 등록된 물건이 없어요', { exact: true }).waitFor()
  await filters.getByRole('radio', { name: '도서', exact: true }).click()
  await page.getByRole('link', { name: /아기와 함께/ }).waitFor()
  const problems = await page.evaluate(() => {
    const errors: string[] = []
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
      errors.push('페이지 가로 넘침')
    for (const el of document.querySelectorAll<HTMLElement>(
      'main li a, main button[role="radio"]',
    )) {
      const b = el.getBoundingClientRect()
      if (b.right > document.documentElement.clientWidth + 1) errors.push('목록·필터 넘침')
      if (el.scrollWidth > el.clientWidth + 1) errors.push('글자 잘림')
    }
    return errors
  })
  assert.deepEqual(problems, [])
  await page.getByRole('tab', { name: /살 물건/ }).click()
  assert.equal(new URL(page.url()).searchParams.get('category'), 'books')
  await filters.getByRole('radio', { name: '전체', exact: true }).click()
  await page.getByRole('link', { name: '살 물건 추가', exact: true }).click()
  await page.getByLabel('물건 이름', { exact: true }).waitFor()
  await page.getByRole('button', { name: '추가하기', exact: true }).click()
  await page.getByText('물건 이름을 입력해 주세요', { exact: true }).waitFor()
  await page.getByRole('button', { name: '취소', exact: true }).click()
  await page.getByRole('heading', { name: '쇼핑 목록', exact: true }).waitFor()
  const visibleNav = page.getByRole('navigation', { name: '주 메뉴', exact: true }).first()
  await visibleNav.getByRole('link', { name: '설정', exact: true }).click()
  const toggle = page.getByRole('switch', { name: '하단 메뉴에 쇼핑 표시', exact: true })
  await toggle.click()
  assert.equal(await page.locator('nav[aria-label="주 메뉴"]').last().locator('a').count(), 5)
  await visibleNav.getByRole('link', { name: '쇼핑', exact: true }).click()
  if (page.viewportSize()!.width < 768)
    assert.equal(
      await page.getByRole('link', { name: '설정', exact: true }).last().isVisible(),
      true,
    )
  await page.reload()
  await visibleNav.getByRole('link', { name: '쇼핑', exact: true }).waitFor()
  await page.getByRole('heading', { name: '쇼핑 목록', exact: true }).waitFor()
}
