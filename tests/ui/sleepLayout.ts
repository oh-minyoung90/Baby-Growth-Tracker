import assert from 'node:assert/strict'
import type { Page } from '@playwright/test'
import { fixtureChild, prepareFixturePage } from './fixture.ts'

/** 실제 폼·라우트를 사용하고 인증·DB 응답만 가명 데이터로 대체한다. */
export async function prepareSleepPage(page: Page) {
  await prepareFixturePage(page, '/sleep/new?date=2026-11-15', {
    '/rest/v1/children': fixtureChild,
    '/rest/v1/sleep_logs': [],
  })
  await page.getByLabel('잠든 시간', { exact: true }).waitFor()
  await page.evaluate(() => document.fonts.ready)
}

/** 페이지 너비뿐 아니라 카드 안 입력칸의 겹침·글자 잘림도 검사한다. */
export async function assertSleepLayout(page: Page) {
  const errors = await page.evaluate(() => {
    const errors: string[] = []
    const viewport = document.documentElement.clientWidth
    if (document.documentElement.scrollWidth > viewport + 1) errors.push('페이지 가로 넘침')
    const inputs = [...document.querySelectorAll<HTMLInputElement>('input[type="time"]')]
    if (inputs.length < 2) errors.push('밤잠 입력칸 누락')
    const boxes = inputs.map((input) => input.getBoundingClientRect())
    for (let i = 0; i < inputs.length; i++) {
      const box = boxes[i]
      const container = inputs[i].parentElement!
      const parent = container.getBoundingClientRect()
      if (box.width < 44 || box.height < 44) errors.push(`시간 입력 ${i}: 터치 영역 부족`)
      if (box.left < -1 || box.right > viewport + 1) errors.push(`시간 입력 ${i}: 화면 밖 넘침`)
      if (box.left < parent.left - 1 || box.right > parent.right + 1)
        errors.push(`시간 입력 ${i}: 부모 밖 넘침`)
      const text = container.querySelector('span')
      if (!text || text.textContent !== (inputs[i].value || '시간 선택'))
        errors.push(`시간 입력 ${i}: 표시값 불일치`)
      if (text && text.scrollWidth > text.clientWidth + 1) errors.push(`시간 입력 ${i}: 글자 잘림`)
      for (let j = i + 1; j < boxes.length; j++) {
        const other = boxes[j]
        if (
          Math.min(box.right, other.right) - Math.max(box.left, other.left) > 1 &&
          Math.min(box.bottom, other.bottom) - Math.max(box.top, other.top) > 1
        )
          errors.push(`시간 입력 ${i}·${j}: 겹침`)
      }
    }
    return errors
  })
  assert.deepEqual(errors, [])
}

export async function exerciseSleepLayout(page: Page) {
  await prepareSleepPage(page)
  await assertSleepLayout(page)
  const bed = page.getByLabel('잠든 시간', { exact: true })
  const wake = page.getByLabel('일어난 시간', { exact: true })
  await bed.fill('21:30')
  await wake.fill('07:00')
  await assertSleepLayout(page)
  await page.getByRole('button', { name: '낮잠 추가' }).click()
  await assertSleepLayout(page)
  await page.getByLabel('낮잠 1 시작', { exact: true }).fill('14:00')
  await page.getByLabel('낮잠 1 끝', { exact: true }).fill('13:00')
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await page.getByText(/끝 시간이 시작/).waitFor()
  await assertSleepLayout(page)
  await page.getByLabel('낮잠 1 끝', { exact: true }).fill('15:00')
  await page.getByRole('region', { name: '총 수면 시간' }).getByText('총 10시간 30분').waitFor()
  await assertSleepLayout(page)
  await wake.focus()
  assert.equal(await wake.evaluate((element) => element === document.activeElement), true)
  await bed.fill('')
  await assertSleepLayout(page)
  await page.getByRole('button', { name: '낮잠 1 삭제', exact: true }).click()
  await assertSleepLayout(page)
}
