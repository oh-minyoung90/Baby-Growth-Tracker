import assert from 'node:assert/strict'
import type { Page } from '@playwright/test'
import { fixtureChild, prepareFixturePage } from './fixture.ts'
export async function exercisePreparationLayout(page: Page) {
  await prepareFixturePage(page, '/preparation', {
    '/rest/v1/children': fixtureChild,
    '/rest/v1/preparation_tasks': [
      {
        id: 'task-fixture',
        name: 'LongPreparationTask'.repeat(4),
        due_date: '2027-12-31',
        memo: '문화센터 등록 일정과 방문 체험 수업의 비용을 확인해요'.repeat(4),
        url: 'https://example.com/class',
        completed: false,
      },
      {
        id: 'task-completed',
        name: '완료한 가명 할 일',
        due_date: null,
        memo: null,
        url: null,
        completed: true,
      },
    ],
    '/rest/v1/shopping_items': [],
  })
  await page.getByText('할 일 1개', { exact: true }).waitFor()
  const tabs = page.getByRole('navigation', { name: '준비 목록 종류', exact: true })
  assert.deepEqual(await tabs.getByRole('link').allTextContents(), ['해야 할 일', '사야 할 물건'])
  await page.getByText('완료한 일 1개', { exact: true }).click()
  await page.getByRole('checkbox', { name: '완료한 가명 할 일 완료', exact: true }).waitFor()
  const checkOverflow = async () => {
    const errors = await page.evaluate(() => {
      const errors: string[] = []
      if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
        errors.push('페이지 가로 넘침')
      for (const el of document.querySelectorAll<HTMLElement>(
        'main li a, main input, main textarea',
      )) {
        const box = el.getBoundingClientRect()
        if (box.width && box.right > document.documentElement.clientWidth + 1)
          errors.push('내용 넘침')
        if (el.tagName === 'A' && el.scrollWidth > el.clientWidth + 1) errors.push('글자 잘림')
      }
      return errors
    })
    assert.deepEqual(errors, [])
  }
  await checkOverflow()
  await page.getByRole('link', { name: '할 일 추가', exact: true }).click()
  await page.getByRole('textbox', { name: '해야 할 일', exact: true }).waitFor()
  assert.equal(await page.getByLabel('마감일 (선택)', { exact: true }).inputValue(), '')
  await page.getByRole('button', { name: '추가하기', exact: true }).click()
  await page.getByText('해야 할 일을 입력해 주세요', { exact: true }).waitFor()
  await checkOverflow()
  await page.getByRole('button', { name: '취소', exact: true }).click()
  await tabs.getByRole('link', { name: '사야 할 물건', exact: true }).click()
  await page.getByRole('link', { name: '살 물건 추가', exact: true }).waitFor()
  await tabs.getByRole('link', { name: '해야 할 일', exact: true }).click()
  await page.getByText('할 일 1개', { exact: true }).waitFor()
}
