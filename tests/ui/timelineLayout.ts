import assert from 'node:assert/strict'
import type { Page } from '@playwright/test'
import { fixtureChild, prepareFixturePage } from './fixture.ts'

export async function prepareTimelinePage(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-19T09:00:00+09:00'))
  const food = {
    food_group: 'vegetable',
    status: 'tried',
    caution_tag: false,
    manual_tried: true,
    manual_first_tried_date: null,
    preference: null,
    memo: null,
    reaction_date: null,
    symptom_note: null,
    check_note: null,
  }
  await prepareFixturePage(page, '/growth/timeline', {
    '/rest/v1/children': fixtureChild,
    '/rest/v1/milestones': [
      {
        id: 'w1',
        type: 'word',
        date: '2026-11-18',
        title: '새로운 단어를 또박또박 말했어요',
        memo: '검사용 가명 기록',
      },
      { id: 'e1', type: 'expression', date: '2026-11-03', title: '활짝 웃었어요', memo: null },
      { id: 'b1', type: 'behavior', date: '2026-10-15', title: '혼자 섰어요', memo: null },
      { id: 'w2', type: 'word', date: '2026-10-10', title: '맘마', memo: null },
    ],
    '/rest/v1/foods': [
      { ...food, id: 'f1', name: '브로콜리', first_tried_date: '2026-11-16' },
      { ...food, id: 'f2', name: '날짜 모름', first_tried_date: null },
    ],
    '/rest/v1/body_measures': [
      { id: 'm1', date: '2026-11-15', height_cm: 75.2, weight_kg: 9.4, memo: null },
    ],
  })
  await page.getByRole('button', { name: '단어 2개', exact: true }).waitFor()
  await page.evaluate(() => document.fonts.ready)
}

export async function assertTimelineLayout(page: Page) {
  const issues = await page.evaluate(() => {
    const errors: string[] = []
    const width = document.documentElement.clientWidth
    if (document.documentElement.scrollWidth > width + 1) errors.push('페이지 가로 넘침')
    const group = document.querySelector<HTMLElement>('[aria-label="유형별 개수"]')!
    const cards = [...group.querySelectorAll('button')]
    if (cards.length !== 4) errors.push('누적 카드 4개 누락')
    const groupBox = group.getBoundingClientRect()
    const boxes = cards.map((card) => card.getBoundingClientRect())
    const columns = width >= 1024 ? 4 : 2
    for (let i = 0; i < cards.length; i++) {
      const box = boxes[i]
      if (width < 1024 && Math.abs(box.height - 52) > 1) errors.push('모바일 한 줄형 높이 불일치')
      if (box.width < 44 || box.height < 44) errors.push('누적 카드 터치 영역 부족')
      if (box.left < groupBox.left - 1 || box.right > groupBox.right + 1)
        errors.push('누적 카드 부모 밖 넘침')
      if (
        cards[i].scrollWidth > cards[i].clientWidth + 1 ||
        cards[i].scrollHeight > cards[i].clientHeight + 1
      )
        errors.push('카드 내용 잘림')
      if (Math.abs(box.top - boxes[Math.floor(i / columns) * columns].top) > 1)
        errors.push('누적 카드 열 배치 불일치')
      for (let j = i + 1; j < cards.length; j++)
        if (
          Math.min(box.right, boxes[j].right) - Math.max(box.left, boxes[j].left) > 1 &&
          Math.min(box.bottom, boxes[j].bottom) - Math.max(box.top, boxes[j].top) > 1
        )
          errors.push('카드 겹침')
    }
    if (document.querySelector('[role="group"][aria-label="유형"]'))
      errors.push('중복 유형 필터 잔존')
    const food = cards[3].querySelector('svg')?.parentElement
    const row = document.querySelector('a[href="/meals/foods/f1"] svg')?.parentElement
    if (food && row) {
      const fill = getComputedStyle(food).backgroundColor
      if (fill !== getComputedStyle(row).backgroundColor) errors.push('음식 아이콘 색 불일치')
      const expected = document.documentElement.classList.contains('dark')
        ? 'rgb(64, 53, 28)'
        : 'rgb(255, 243, 205)'
      if (fill !== expected) errors.push('음식 아이콘 노란색 토큰 불일치')
    } else errors.push('음식 아이콘 누락')
    return errors
  })
  assert.deepEqual(issues, [])
}

export async function exerciseTimelineLayout(page: Page) {
  await prepareTimelinePage(page)
  await assertTimelineLayout(page)
  if (page.viewportSize()!.width < 768) {
    const bar = await page.getByRole('navigation', { name: '주 메뉴' }).boundingBox()
    const add = await page.getByRole('button', { name: '발달 기록 추가' }).boundingBox()
    assert.ok(bar && add && bar.y - (add.y + add.height) >= 19, '추가 버튼과 하단 탭의 여백')
  }
  const waitRecords = async (count: number) => {
    await page.waitForFunction(
      (expected) => document.querySelectorAll('main li > a').length === expected,
      count,
    )
    assert.equal(await page.locator('main li > a').count(), count)
  }
  const period = page.getByRole('radiogroup', { name: '기간' })
  const word = page.getByRole('button', { name: '단어 2개', exact: true })
  const food = page.getByRole('button', { name: '처음 먹은 음식 1개', exact: true })
  await period.getByRole('radio', { name: '이번 달', exact: true }).click()
  await waitRecords(3)
  await word.click()
  await waitRecords(1)
  assert.equal(
    await period.getByRole('radio', { name: '이번 달', exact: true }).getAttribute('aria-checked'),
    'true',
  )
  assert.equal(await word.getAttribute('aria-pressed'), 'true')
  assert.equal(await page.locator('main li > a').count(), 1)
  await word.click()
  await waitRecords(3)
  await food.click()
  await waitRecords(1)
  await period.getByRole('radio', { name: '지난 달', exact: true }).click()
  await page.getByText('조건에 맞는 기록이 없어요', { exact: true }).waitFor()
  assert.equal(await food.getAttribute('aria-pressed'), 'true')
  assert.equal(await page.getByRole('button', { name: '전체 보기', exact: true }).count(), 0)
  await food.click()
  assert.equal(
    await period.getByRole('radio', { name: '지난 달', exact: true }).getAttribute('aria-checked'),
    'true',
  )
  await waitRecords(2)
  await period.getByRole('radio', { name: '직접 선택', exact: true }).click()
  await waitRecords(3)
  await page.getByLabel('시작일', { exact: true }).fill('2026-10-01')
  await waitRecords(5)
  await page.getByLabel('종료일', { exact: true }).fill('2026-10-31')
  await waitRecords(2)
  await word.click()
  await waitRecords(1)
  assert.equal(await page.getByLabel('시작일', { exact: true }).inputValue(), '2026-10-01')
  assert.equal(await page.locator('main li > a').count(), 1)
  await page.getByRole('link', { name: '키·몸무게', exact: true }).click()
  await page.getByText('75.2', { exact: false }).first().waitFor()
  assert.equal(new URL(page.url()).pathname, '/growth/body')
  assert.equal(await page.getByRole('group', { name: '유형별 개수' }).count(), 0)
}
