import assert from 'node:assert/strict'
import type { Page } from '@playwright/test'
import { fixtureChild, prepareFixturePage } from './fixture.ts'

const sections = ['오늘의 식단', '오늘의 기록', '어젯밤 수면', '최근 측정']

/** 가명 데이터: 긴 음식 이름·발달 기록이 있어도 세로 카드와 버튼이 넘치지 않아야 한다. */
export async function prepareHomePage(page: Page, empty = false, partialMeals = false) {
  await page.clock.setFixedTime(new Date('2026-11-18T09:00:00+09:00'))
  await prepareFixturePage(page, '/', {
    '/rest/v1/children': fixtureChild,
    '/rest/v1/milestones': empty
      ? []
      : [
          {
            id: 'milestone-fixture',
            type: 'word',
            date: '2026-11-18',
            title: '혼자서 새로운 단어를 말하며 웃었어요',
            memo: '가명 기록의 긴 메모를 보여 줍니다',
          },
        ],
    '/rest/v1/sleep_logs': empty
      ? []
      : [
          {
            id: 'sleep-fixture',
            date: '2026-11-17',
            bed_time: '2026-11-17T21:30',
            wake_time: '2026-11-18T07:00',
            naps: [{ start: '2026-11-17T13:00', end: '2026-11-17T14:00' }],
            memo: null,
          },
        ],
    '/rest/v1/body_measures': empty
      ? []
      : [
          {
            id: 'measure-fixture',
            date: '2026-11-15',
            height_cm: 75.2,
            weight_kg: 9.4,
            memo: null,
          },
        ],
    '/rest/v1/foods': [],
    '/rest/v1/recipes': [],
    '/rest/v1/meal_entries': empty
      ? []
      : (partialMeals ? ['breakfast'] : ['breakfast', 'lunch', 'dinner', 'snack']).map(
          (type, i) => ({
            id: `meal-fixture-${i}`,
            date: '2026-11-18',
            meal_type: type,
            eaten: i === 0,
            intake: null,
            memo: null,
            meal_entry_foods: [
              {
                food_id: null,
                food_name: i === 1 ? 'LongFoodName'.repeat(10) : '바나나, 계란, 그릭요거트',
                position: 0,
              },
            ],
            meal_entry_recipes: [],
          }),
        ),
  })
  await page.getByRole('heading', { name: /^가명아기/ }).waitFor()
  if (empty) await page.getByRole('button', { name: '오늘 성장 기록하기', exact: true }).waitFor()
  else await page.getByText('10시간 30분', { exact: true }).waitFor()
  await page.evaluate(() => document.fonts.ready)
}

export async function assertHomeLayout(page: Page, empty = false) {
  const errors = await page.evaluate(
    ({ sections, empty }) => {
      const errors: string[] = []
      const viewport = document.documentElement.clientWidth
      if (document.documentElement.scrollWidth > viewport + 1) errors.push('페이지 가로 넘침')
      const cards = [...document.querySelectorAll<HTMLElement>('main section[aria-labelledby]')]
      if (
        cards.map((card) => card.querySelector('h2')?.textContent).join('|') !== sections.join('|')
      )
        errors.push('홈 카드 순서 불일치')
      const first = cards[0].getBoundingClientRect()
      cards.forEach((card, i) => {
        const box = card.getBoundingClientRect()
        if (Math.abs(box.left - first.left) > 1 || Math.abs(box.width - first.width) > 1)
          errors.push(`${sections[i]}: 폭·시작점 불일치`)
        if (i > 0 && box.top < cards[i - 1].getBoundingClientRect().bottom)
          errors.push(`${sections[i]}: 별도 행 누락`)
        const title = card.querySelector('h2')!
        const style = getComputedStyle(title)
        if (style.fontSize !== '16px' || style.fontWeight !== '700' || style.lineHeight !== '24px')
          errors.push(`${sections[i]}: 제목 규격 불일치`)
        if (i < 4) {
          const icon = title.querySelector('svg')!.getBoundingClientRect()
          if (icon.width !== 20 || icon.height !== 20)
            errors.push(`${sections[i]}: 아이콘 규격 불일치`)
        }
        for (const link of card.querySelectorAll<HTMLElement>('a, button')) {
          const item = link.getBoundingClientRect()
          if (item.width < 44 || item.height < 44) errors.push(`${sections[i]}: 터치 영역 부족`)
          if (item.left < box.left || item.right > box.right + 1)
            errors.push(`${sections[i]}: 카드 밖 넘침`)
        }
      })
      for (const card of cards) {
        const heading = card.querySelector('h2')!.getBoundingClientRect()
        const action = card.querySelector('h2')!.parentElement!.querySelector('a, button')
        if (action && heading.right > action.getBoundingClientRect().left)
          errors.push('카드 제목·동작 버튼 겹침')
      }
      if (!empty) {
        const total = cards[2].querySelector('dd')!
        const height = cards[3].querySelector('dd')!
        for (const value of [total, height]) {
          const style = getComputedStyle(value)
          if (style.fontSize !== '14px' || style.fontWeight !== '700')
            errors.push('수면·측정 값 크기 불일치')
        }
        if (cards[2].querySelector('dt')?.textContent !== '총') errors.push('수면 총 라벨 누락')
      }
      const nav = [...document.querySelectorAll<HTMLElement>('nav[aria-label="주 메뉴"]')].find(
        (element) => getComputedStyle(element).display !== 'none',
      )!
      if (
        [...nav.querySelectorAll('a')].map((link) => link.textContent).join('|') !==
        '홈|식사|성장|수면|설정'
      )
        errors.push('주 메뉴 순서 불일치')
      return errors
    },
    { sections, empty },
  )
  assert.deepEqual(errors, [])
}

export async function exerciseHomeLayout(page: Page, empty = false, partialMeals = false) {
  await prepareHomePage(page, empty, partialMeals)
  await assertHomeLayout(page, empty)
  assert.equal(await page.getByRole('region', { name: '빠른 기록' }).count(), 0)
  const growth = page.getByRole('button', {
    name: empty ? '오늘 성장 기록하기' : '성장 기록 추가',
    exact: true,
  })
  await growth.click()
  const menu = page.getByRole('dialog', { name: '성장 기록', exact: true })
  await menu.waitFor()
  assert.deepEqual(await menu.getByRole('link').allTextContents(), ['단어', '행동', '표정'])
  const box = await menu.boundingBox()
  assert.ok(
    box && box.x >= 0 && box.x + box.width <= page.viewportSize()!.width + 1,
    '성장 메뉴 화면 밖 넘침',
  )
  await menu.getByRole('button', { name: '취소', exact: true }).click()
  await menu.waitFor({ state: 'hidden' })
  assert.equal(await growth.evaluate((element) => element === document.activeElement), true)

  if (empty || partialMeals) {
    const meal = page.getByRole('button', {
      name: empty ? '오늘 식단 기록하기' : '식단 추가',
      exact: true,
    })
    await meal.click()
    const picker = page.getByRole('dialog', { name: '끼니 선택', exact: true })
    await picker.waitFor()
    assert.deepEqual(
      await picker.getByRole('link').allTextContents(),
      empty ? ['아침', '점심', '저녁', '간식'] : ['점심', '저녁', '간식'],
    )
    const bounds = await picker.boundingBox()
    assert.ok(
      bounds && bounds.x >= 0 && bounds.x + bounds.width <= page.viewportSize()!.width + 1,
      '끼니 메뉴 화면 밖 넘침',
    )
    await picker.getByRole('link', { name: '점심', exact: true }).click()
    const editor = page.getByRole('dialog', { name: '식단 기록', exact: true })
    await editor.waitFor()
    assert.equal(new URL(page.url()).searchParams.get('meal'), 'lunch')
    await editor.getByRole('button', { name: '취소', exact: true }).click()
    await page.waitForURL('http://127.0.0.1:4180/')
    await editor.waitFor({ state: 'hidden' })
  } else {
    assert.equal(await page.getByRole('button', { name: '식단 추가', exact: true }).count(), 0)
  }

  if (empty) {
    assert.equal(
      await page.getByRole('link', { name: '어젯밤 수면 기록하기', exact: true }).count(),
      1,
    )
    assert.equal(
      await page.getByRole('link', { name: '키·몸무게 기록하기', exact: true }).count(),
      1,
    )
  } else {
    await page.getByRole('link', { name: '어젯밤 수면 수정', exact: true }).click()
    await page.getByLabel('수면일', { exact: true }).waitFor()
    assert.equal(await page.getByLabel('수면일', { exact: true }).inputValue(), '2026-11-17')
    assert.equal(new URL(page.url()).pathname, '/sleep/sleep-fixture')
    await page.getByRole('button', { name: '취소', exact: true }).click()
    await page.waitForURL('http://127.0.0.1:4180/')
    await page.getByRole('link', { name: '키·몸무게 기록 추가', exact: true }).click()
    const editor = page.getByRole('dialog', { name: '키·몸무게 기록', exact: true })
    await editor.waitFor()
    assert.equal(await editor.getByLabel('측정 날짜', { exact: true }).inputValue(), '2026-11-18')
    await editor.getByRole('button', { name: '취소', exact: true }).click()
    await page.waitForURL('http://127.0.0.1:4180/')
    await editor.waitFor({ state: 'hidden' })
  }
}
