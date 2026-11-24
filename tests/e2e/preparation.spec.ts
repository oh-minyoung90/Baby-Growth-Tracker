import { test, expect, exported } from './fixtures.ts'

test('할 일: 홈 진입·추가·새로고침·완료 되돌리기·수정·삭제', async ({ page, data }) => {
  await page.goto('/')
  await page
    .getByRole('link', { name: '준비 목록 보기, 할 일 0개 · 살 물건 0개', exact: true })
    .click()
  await page.getByRole('link', { name: '할 일 추가', exact: true }).click()
  await page.getByRole('textbox', { name: '해야 할 일', exact: true }).fill('검증 문화센터 등록')
  await page.getByLabel('마감일 (선택)', { exact: true }).fill('2027-01-01')
  await page.getByLabel('메모 (선택)', { exact: true }).fill('겨울학기 접수 일정 확인')
  await page.getByLabel('관련 링크 (선택)', { exact: true }).fill('https://example.com/class')
  await page.getByRole('button', { name: '추가하기', exact: true }).click()
  await expect(page.getByText('할 일 1개', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('link', { name: /관련 링크/ })).toHaveAttribute(
    'href',
    'https://example.com/class',
  )
  await page.getByRole('checkbox', { name: '검증 문화센터 등록 완료', exact: true }).click()
  await expect(page.getByText('할 일 0개', { exact: true })).toBeVisible()
  await page.getByText('완료한 일 1개', { exact: true }).click()
  await page.getByRole('checkbox', { name: '검증 문화센터 등록 완료', exact: true }).click()
  await expect(page.getByText('할 일 1개', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: /검증 문화센터 등록/ }).click()
  await page.getByRole('button', { name: '마감일 지우기', exact: true }).click()
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await expect
    .poll(async () => (await exported(data)).data.preparation_tasks[0].due_date)
    .toBeNull()
  await expect(page.getByRole('link', { name: '할 일 추가', exact: true })).toBeVisible()
  await page
    .getByRole('navigation', { name: '주 메뉴', exact: true })
    .first()
    .getByRole('link', { name: '홈', exact: true })
    .click()
  await expect(
    page.getByRole('link', { name: '준비 목록 보기, 할 일 1개 · 살 물건 0개', exact: true }),
  ).toBeVisible()
  await page.getByRole('link', { name: /준비 목록 보기/ }).click()
  await page.getByRole('link', { name: /검증 문화센터 등록/ }).click()
  await page.getByRole('button', { name: '삭제', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: '삭제', exact: true }).click()
  await expect(page.getByText('할 일 0개', { exact: true })).toBeVisible()
  await expect.poll(async () => (await exported(data)).data.preparation_tasks.length).toBe(0)
})
