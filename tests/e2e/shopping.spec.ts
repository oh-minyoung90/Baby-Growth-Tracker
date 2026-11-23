import { test, expect, exported } from './fixtures.ts'

test('쇼핑: 입력·구매 체크·다시 담기·링크 수정·메뉴 설정·삭제', async ({ page, data }) => {
  await page.goto('/')
  await page.getByRole('link', { name: /사야 할 물건/ }).click()
  await page.getByRole('link', { name: '살 물건 추가', exact: true }).click()
  await page.getByLabel('물건 이름', { exact: true }).fill('검증 그림책')
  await page.getByRole('radio', { name: '도서', exact: true }).click()
  await page.getByLabel('구매 링크 (선택)', { exact: true }).fill('https://example.com/books')
  await page.getByLabel('메모 (선택)', { exact: true }).fill('보드북 한 권')
  await page.getByRole('checkbox', { name: '자주 사는 물건에 보관', exact: true }).check()
  await page.getByRole('button', { name: '추가하기', exact: true }).click()
  await expect.poll(async () => (await exported(data)).data.shopping_items.length).toBe(1)
  await page.getByRole('checkbox', { name: '검증 그림책 구매 완료', exact: true }).click()
  await expect
    .poll(async () => (await exported(data)).data.shopping_items[0].status)
    .toBe('purchased')
  await page.getByText('구매 완료 1개', { exact: true }).click()
  await expect(
    page.getByRole('checkbox', { name: '검증 그림책 구매 완료', exact: true }),
  ).toBeChecked()
  await page.getByRole('tab', { name: /자주 사는 물건/ }).click()
  await page.getByRole('button', { name: '다시 담기', exact: true }).click()
  await expect(page.getByRole('button', { name: '목록에 있음', exact: true })).toBeDisabled()
  await page.reload()
  await expect(page.getByRole('button', { name: '목록에 있음', exact: true })).toBeDisabled()
  expect((await exported(data)).data.shopping_items.length).toBe(1)
  await page.getByRole('link', { name: /검증 그림책/ }).click()
  await page.getByLabel('구매 링크 (선택)', { exact: true }).fill('https://example.com/book-again')
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await expect(page.getByRole('link', { name: /구매 링크/ })).toHaveAttribute(
    'href',
    'https://example.com/book-again',
  )
  await page
    .getByRole('navigation', { name: '주 메뉴', exact: true })
    .first()
    .getByRole('link', { name: '설정', exact: true })
    .click()
  await page.getByRole('switch', { name: '하단 메뉴에 쇼핑 표시', exact: true }).click()
  await page
    .getByRole('navigation', { name: '주 메뉴', exact: true })
    .first()
    .getByRole('link', { name: '쇼핑', exact: true })
    .click()
  await page.reload()
  await expect(
    page
      .getByRole('navigation', { name: '주 메뉴', exact: true })
      .first()
      .getByRole('link', { name: '쇼핑', exact: true }),
  ).toBeVisible()
  if (page.viewportSize()!.width < 768)
    await expect(
      page.locator('main header').getByRole('link', { name: '설정', exact: true }),
    ).toBeVisible()
  await page.getByRole('link', { name: /검증 그림책/ }).click()
  await page.getByRole('button', { name: '삭제', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: '삭제', exact: true }).click()
  await expect.poll(async () => (await exported(data)).data.shopping_items.length).toBe(0)
})
