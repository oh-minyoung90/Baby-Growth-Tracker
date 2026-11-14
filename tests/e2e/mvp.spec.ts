import { readFile } from 'node:fs/promises'
import { isDeepStrictEqual } from 'node:util'
import { test, expect, authenticate, day, labelDate, exported } from './fixtures.ts'
import { replace, type Data } from './data.ts'
import { emptyBackup, exampleBackup } from '../../src/test/backupFixture.ts'
import type { Page } from '@playwright/test'

const save = (page: Page) => page.getByRole('button', { name: '저장', exact: true }).click()
async function deleteRecord(page: Page) {
  await page.getByRole('button', { name: '삭제', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: '삭제', exact: true }).click()
}
async function food(data: Data, name = '검증 쌀', caution = false) {
  const result = await data.client.rpc('add_food', { name, food_group: 'grain' })
  if (result.error) throw new Error('가명 음식 준비 실패')
  if (caution) {
    const designated = await data.client.rpc('set_food_caution', {
      food_id: result.data.id,
      reaction_date: day(),
      today: day(),
    })
    if (designated.error) throw new Error('가명 주의 음식 준비 실패')
  }
  return result.data.id
}
async function state(data: Data, id: string) {
  return (await exported(data)).data.foods.find((item) => item.id === id)
}
async function meal(page: Page, date: string, type = 'breakfast') {
  await page.goto(`/meals/week?record=new&date=${date}&meal=${type}`)
  return page.getByRole('dialog', { name: '식단 기록', exact: true })
}
async function selectFood(page: Page, name = '검증 쌀') {
  await page.getByRole('searchbox', { name: '식단에 넣을 음식 검색' }).fill(name)
  await page
    .getByRole('list', { name: '음식 검색 결과' })
    .getByRole('button', { name: new RegExp(`^${name}`) })
    .click()
}
async function closed(page: Page) {
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

test('로그인 가드, 첫 등록, 빈 화면과 홈·빠른 기록', async ({ page, browser, data }) => {
  const anonymous = await browser.newContext()
  try {
    const guest = await anonymous.newPage()
    await guest.goto('http://127.0.0.1:4173/growth/timeline')
    await expect(guest).toHaveURL(/\/login$/)
    await expect(guest.getByRole('button', { name: /코드/ })).toBeVisible()
    await expect(guest.getByRole('link', { name: '회원가입' })).toHaveCount(0)
  } finally {
    await anonymous.close()
  }
  await replace(data, emptyBackup(data.owner))
  await page.goto('/')
  await expect(page).toHaveURL(/\/setup$/)
  await page.getByRole('button', { name: '시작하기' }).click()
  await expect(page.getByText('이름 또는 별명을 입력해 주세요', { exact: true })).toBeVisible()
  await page.getByLabel('이름 또는 별명').fill('자동검증아기')
  await page.getByLabel('생년월일').fill('2026-01-08')
  await page.getByRole('button', { name: '시작하기' }).click()
  await expect(page).toHaveURL('http://127.0.0.1:4173/')
  await expect(page.getByText(/자동검증아기/).first()).toBeVisible()
  await expect(page.getByText(/개월.*일/).first()).toBeVisible()
  await page
    .getByRole('region', { name: '빠른 기록' })
    .getByRole('link', { name: '식단', exact: true })
    .click()
  await expect(page).toHaveURL(new RegExp(`/meals/week\\?date=${day()}`))
  await expect(page.getByRole('region', { name: labelDate(day()), exact: true })).toBeVisible()
  await expect.poll(async () => (await exported(data)).data.foods.length).toBeGreaterThan(0)
})

test('키·몸무게: 빈 차트 → 검증 → 1건 → 수정·삭제', async ({ page, data }) => {
  await page.goto('/growth/body')
  await expect(page.getByText('아직 측정 기록이 없어요', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '측정 기록 추가', exact: true }).click()
  await expect(page.getByLabel('측정 날짜')).toHaveValue(day())
  await save(page)
  await expect(page.getByText('키와 몸무게 중 하나 이상 입력해 주세요')).toBeVisible()
  await page.getByLabel('키 (cm)', { exact: true }).fill('151')
  await save(page)
  await expect(page.getByText('키는 30~150cm 사이로 입력해 주세요')).toBeVisible()
  await page.getByLabel('키 (cm)', { exact: true }).fill('72.5')
  await page.getByLabel('측정 날짜').fill(day(1))
  await save(page)
  await expect(page.getByText('오늘 이후 날짜는 고를 수 없어요')).toBeVisible()
  await page.getByLabel('측정 날짜').fill('2026-01-07')
  await save(page)
  await expect(page.getByText('생년월일 이전 날짜는 고를 수 없어요')).toBeVisible()
  await page.getByLabel('측정 날짜').fill(day())
  await page.getByLabel('몸무게 (kg)', { exact: true }).fill('8.8')
  await save(page)
  await closed(page)
  await expect(page.getByRole('button', { name: /72.5.*8.8/ })).toBeVisible()
  const measure = (await exported(data)).data.body_measures[0]
  await page.goto(`/growth/body?record=${measure.id}`)
  await page.getByLabel('몸무게 (kg)', { exact: true }).fill('9.1')
  await save(page)
  await closed(page)
  await expect(page.getByRole('button', { name: /72.5.*9.1/ })).toBeVisible()
  await page.goto(`/growth/body?record=${measure.id}`)
  await deleteRecord(page)
  await closed(page)
  await expect(page.getByText('아직 측정 기록이 없어요', { exact: true })).toBeVisible()
  expect((await exported(data)).data.body_measures).toHaveLength(0)
})

test('단어·행동·표정 생성, 중복·유사 안내, 수정과 삭제', async ({ page, data }) => {
  for (const [type, title] of [
    ['word', '안녕'],
    ['behavior', '혼자 서기'],
    ['expression', '활짝 웃기'],
  ]) {
    await page.goto(`/milestones/new?type=${type}`)
    await expect(page.getByLabel('날짜', { exact: true })).toHaveValue(day())
    await page.getByLabel('내용', { exact: true }).fill(title)
    await save(page)
    await expect
      .poll(async () => (await exported(data)).data.milestones.length)
      .toBe(type === 'word' ? 1 : type === 'behavior' ? 2 : 3)
  }
  await page.goto('/milestones/new?type=word')
  await page.getByLabel('내용', { exact: true }).fill('안녕')
  await expect(page.getByText('안녕', { exact: true })).toBeVisible()
  await save(page)
  await expect(page.getByRole('alertdialog').getByText('이미 말한 단어예요')).toBeVisible()
  await page.getByRole('alertdialog').getByRole('button', { name: '확인' }).click()
  expect((await exported(data)).data.milestones).toHaveLength(3)
  const id = (await exported(data)).data.milestones.find((item) => item.type === 'word')!.id
  await page.goto(`/milestones/${id}`)
  await page.getByLabel('내용', { exact: true }).fill('엄마')
  await save(page)
  await expect
    .poll(async () => (await exported(data)).data.milestones.some((item) => item.title === '엄마'))
    .toBe(true)
  await page.goto('/growth/timeline')
  await expect(page.getByText('엄마', { exact: true })).toBeVisible()
  await page.goto(`/milestones/${id}`)
  await deleteRecord(page)
  await expect.poll(async () => (await exported(data)).data.milestones.length).toBe(2)
})

test('수면: 어제 기본값, 시간 오류, 자정 이후 밤잠·낮잠 합계와 수정·삭제', async ({
  page,
  data,
}) => {
  await page.goto('/sleep')
  await expect(page.getByText('아직 수면 기록이 없어요', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '수면 기록 추가', exact: true }).click()
  await expect(page.getByLabel('수면일', { exact: true })).toHaveValue(day(-1))
  await page.getByLabel('잠든 시간', { exact: true }).fill('00:30')
  await page.getByLabel('일어난 시간', { exact: true }).fill('01:00')
  await save(page)
  await expect(page.getByText(/밤잠은 1시간/)).toBeVisible()
  await page.getByLabel('일어난 시간', { exact: true }).fill('06:30')
  await page.getByRole('button', { name: '낮잠 추가' }).click()
  await page.getByLabel('낮잠 1 시작').fill('14:00')
  await page.getByLabel('낮잠 1 끝').fill('13:00')
  await save(page)
  await expect(page.getByText(/끝 시간이 시작/)).toBeVisible()
  await page.getByLabel('낮잠 1 끝').fill('15:00')
  await page.getByRole('button', { name: '낮잠 추가' }).click()
  await page.getByLabel('낮잠 2 시작').fill('14:30')
  await page.getByLabel('낮잠 2 끝').fill('16:00')
  await save(page)
  await expect(page.getByText(/시간이 서로 겹/)).toBeVisible()
  await page.getByLabel('낮잠 2 시작').fill('16:00')
  await page.getByLabel('낮잠 2 끝').fill('16:30')
  await expect(page.getByRole('region', { name: '총 수면 시간' })).toContainText('총 7시간 30분')
  await save(page)
  await expect(page).toHaveURL(/\/sleep$/)
  const log = (await exported(data)).data.sleep_logs[0]
  expect(log.date).toBe(day(-1))
  expect(log.bed_time?.slice(0, 16)).toBe(`${day()}T00:30`)
  await page.goto(`/sleep/${log.id}`)
  await page.getByLabel('메모', { exact: true }).fill('수정한 수면')
  await save(page)
  await expect(page).toHaveURL(/\/sleep$/)
  await page.goto(`/sleep/${log.id}`)
  await expect(page.getByLabel('메모', { exact: true })).toHaveValue('수정한 수면')
  await deleteRecord(page)
  await expect(page.getByText('아직 수면 기록이 없어요', { exact: true })).toBeVisible()
})

test('음식 추가·수정과 알러지 지정·해제 이력', async ({ page, data }) => {
  await page.goto('/meals/foods?status=not_tried')
  // 탭과 추가 버튼의 실제 URL 계약을 따른다.
  await page.getByRole('button', { name: /아직 안 먹어봄/ }).click()
  await page.getByRole('button', { name: '안 먹어 본 음식 추가', exact: true }).click()
  await page.getByLabel('이름', { exact: true }).fill('검증 사과')
  await page.getByRole('radio', { name: '과일', exact: true }).click()
  await save(page)
  await closed(page)
  const id = (await exported(data)).data.foods[0].id
  await page.goto(`/meals/foods/${id}`)
  await page.getByRole('button', { name: '수정', exact: true }).click()
  await page.getByRole('button', { name: '알러지·주의로 지정', exact: true }).click()
  await page.getByLabel('반응 날짜').fill(day())
  await page.getByLabel('지정 사유 (선택)').fill('가명 주의 확인')
  await page.getByRole('button', { name: '지정', exact: true }).click()
  await closed(page)
  await expect.poll(async () => (await state(data, id))?.status).toBe('caution')
  await page.getByRole('button', { name: '수정', exact: true }).click()
  await page.getByRole('button', { name: '알러지·주의 해제', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: '해제', exact: true }).click()
  await closed(page)
  await expect.poll(async () => (await state(data, id))?.status).toBe('not_tried')
  await expect(page.getByText('사유: 가명 주의 확인', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '수정', exact: true }).click()
  await page.getByLabel('이름', { exact: true }).fill('검증 초록사과')
  await save(page)
  await closed(page)
  await expect(page.getByRole('heading', { name: '검증 초록사과', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '수정', exact: true }).click()
  await deleteRecord(page)
  await expect.poll(async () => (await exported(data)).data.foods.length).toBe(0)
})

test('식단 계획·먹음·첫 음식 타임라인, 복사·이동·충돌·해제', async ({ page, data }, info) => {
  const id = await food(data)
  const sheet = await meal(page, day())
  await selectFood(page)
  await sheet.getByLabel('메모', { exact: true }).fill('복사할 메모')
  await sheet.getByRole('checkbox', { name: '먹음', exact: true }).click()
  await save(page)
  await closed(page)
  expect((await state(data, id))?.status).toBe('not_tried')
  const eaten = page.getByRole('checkbox', { name: `${labelDate(day())} 아침 먹음`, exact: true })
  await eaten.click()
  await expect(eaten).toBeChecked()
  await expect.poll(async () => (await state(data, id))?.first_tried_date).toBe(day())
  await page.goto('/')
  await expect(page.getByRole('region', { name: '오늘의 식단' })).toContainText('검증 쌀')
  await page.goto('/growth/timeline?types=food')
  await page.getByRole('link', { name: /검증 쌀/ }).click()
  await expect(page).toHaveURL(new RegExp(`/meals/foods/${id}$`))
  await page.goto('/meals/week')
  await page
    .getByRole('region', { name: labelDate(day()), exact: true })
    .getByRole('button', { name: '아침 식단 복사', exact: true })
    .click()
  await page.getByLabel('복사할 날짜').fill(day(1))
  await page
    .getByRole('dialog', { name: '식단 복사', exact: true })
    .getByRole('button', { name: '복사', exact: true })
    .click()
  await closed(page)
  let entries = (await exported(data)).data.meal_entries
  expect(entries).toHaveLength(2)
  const copy = entries.find((entry) => entry.date === day(1))!
  expect({ eaten: copy.eaten, intake: copy.intake, memo: copy.memo }).toEqual({
    eaten: false,
    intake: null,
    memo: '복사할 메모',
  })
  await page.goto(`/meals/week?date=${day(1)}`)
  await expect(
    page.getByRole('checkbox', { name: `${labelDate(day(1))} 아침 먹음`, exact: true }),
  ).toBeDisabled()
  await page
    .getByRole('region', { name: labelDate(day(1)), exact: true })
    .getByRole('button', { name: '아침 식단 이동', exact: true })
    .click()
  await page.getByLabel('옮길 날짜').fill(day())
  await page
    .getByRole('dialog', { name: '식단 이동', exact: true })
    .getByRole('button', { name: '이동', exact: true })
    .click()
  await expect(page.getByRole('dialog', { name: '식단 이동', exact: true })).toContainText(
    /이미 기록/,
  )
  await page.getByRole('radio', { name: '점심', exact: true }).click()
  await page
    .getByRole('dialog', { name: '식단 이동', exact: true })
    .getByRole('button', { name: '이동', exact: true })
    .click()
  await closed(page)
  entries = (await exported(data)).data.meal_entries
  expect(entries.find((entry) => entry.id === copy.id)?.meal_type).toBe('lunch')
  await page.goto('/meals/week')
  if (info.project.name === 'desktop') {
    const section = page.getByRole('region', { name: labelDate(day()), exact: true })
    await section
      .getByRole('button', { name: '점심 식단 드래그로 이동', exact: true })
      .dragTo(section.getByRole('button', { name: '저녁 식단 추가', exact: true }))
    await expect
      .poll(
        async () =>
          (await exported(data)).data.meal_entries.find((entry) => entry.id === copy.id)?.meal_type,
      )
      .toBe('dinner')
  }
  await eaten.click()
  await expect(eaten).not.toBeChecked()
  await expect.poll(async () => (await state(data, id))?.first_tried_date).toBeNull()
  await page.goto('/growth/timeline?types=food')
  await expect(page.getByRole('link', { name: /검증 쌀/ })).toHaveCount(0)
})

test('주의 음식 계획·먹음·복사·태그 해제, 음식 삭제 뒤 식단·재료 이름 보존', async ({
  page,
  data,
}) => {
  const id = await food(data, '검증 주의쌀', true)
  const recipeId = crypto.randomUUID()
  const recipe = await data.client.rpc('save_recipe', {
    id: recipeId,
    name: '주의 재료죽',
    create_new: true,
    ingredients: [{ food_id: id, name: '검증 주의쌀', amount: '30g' }],
    steps: ['끓여요'],
  })
  if (recipe.error) throw new Error('가명 재료 연결 준비 실패')
  const sheet = await meal(page, day())
  await selectFood(page, '검증 주의쌀')
  await sheet.getByRole('checkbox', { name: '먹음', exact: true }).click()
  await save(page)
  await expect(page.getByRole('alertdialog')).toContainText('검증 주의쌀')
  await page.getByRole('alertdialog').getByRole('button', { name: '취소', exact: true }).click()
  expect((await exported(data)).data.meal_entries).toHaveLength(0)
  await save(page)
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: '그래도 저장', exact: true })
    .click()
  await closed(page)
  expect((await state(data, id))?.status).toBe('caution')
  const section = page.getByRole('region', { name: labelDate(day()), exact: true })
  await section.getByRole('button', { name: '아침 식단 복사', exact: true }).click()
  await page.getByLabel('복사할 날짜').fill(day(1))
  await page
    .getByRole('dialog', { name: '식단 복사', exact: true })
    .getByRole('button', { name: '복사', exact: true })
    .click()
  await expect(page.getByRole('alertdialog')).toContainText('검증 주의쌀')
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: '그래도 복사', exact: true })
    .click()
  await closed(page)
  await page.goto('/meals/week')
  const check = page.getByRole('checkbox', { name: `${labelDate(day())} 아침 먹음`, exact: true })
  await check.click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: '그래도 저장', exact: true })
    .click()
  await expect(check).toBeChecked()
  await expect.poll(async () => (await state(data, id))?.caution_tag).toBe(true)
  expect((await state(data, id))?.status).toBe('tried')
  await page.goto(`/meals/foods/${id}`)
  await expect(page.getByRole('region', { name: '음식 정보' })).toContainText('1번')
  await page.getByRole('button', { name: '"주의" 태그 해제', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: '해제', exact: true }).click()
  await expect.poll(async () => (await state(data, id))?.caution_tag).toBe(false)
  await page.getByRole('button', { name: '수정', exact: true }).click()
  await deleteRecord(page)
  await expect.poll(async () => (await exported(data)).data.foods.length).toBe(0)
  await page.goto('/meals/week')
  await expect(page.getByRole('region', { name: labelDate(day()), exact: true })).toContainText(
    '검증 주의쌀',
  )
  await page.goto(`/meals/recipes/${recipeId}`)
  await expect(page.getByText('검증 주의쌀', { exact: true })).toBeVisible()
})

test('레시피 여러 줄·번호·사진 저장, 새 브라우저 유지, 재료 주의와 레시피만 먹음', async ({
  page,
  browser,
  data,
}) => {
  const id = await food(data, '검증 주의쌀', true)
  await page.goto('/meals/recipes')
  await expect(page.getByText('등록된 레시피가 없어요', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '레시피 추가', exact: true }).click()
  await page.getByLabel('레시피 이름', { exact: true }).fill('검증 쌀죽')
  await page.getByLabel('재료', { exact: true }).fill('검증 주의쌀 30g\n물 300ml')
  await page
    .getByLabel('조리 순서', { exact: true })
    .fill('1. 쌀을 씻어요\n깨끗이 헹궈요\n\n2. 물을 넣고 끓여요')
  await expect(page.getByRole('list', { name: '재료 미리보기' }).getByRole('listitem')).toHaveCount(
    2,
  )
  await expect(
    page.getByRole('list', { name: '조리 순서 미리보기' }).getByRole('listitem'),
  ).toHaveCount(2)
  await page.getByRole('button', { name: '재료 1 음식 연결' }).click()
  await page
    .getByRole('list', { name: '재료 1 검색 결과' })
    .getByRole('button', { name: /검증 주의쌀/ })
    .click()
  await page.getByLabel('사진 (선택, 1장)').setInputFiles('docs/examples/backup-example-photo.png')
  await save(page)
  await expect(page).toHaveURL(/\/meals\/recipes$/)
  const recipe = (await exported(data)).data.recipes[0]
  expect(recipe.steps).toEqual(['쌀을 씻어요\n깨끗이 헹궈요', '물을 넣고 끓여요'])
  const another = await browser.newContext()
  try {
    await authenticate(another, data)
    const fresh = await another.newPage()
    await fresh.goto(`http://127.0.0.1:4173/meals/recipes/${recipe.id}`)
    const image = fresh.getByRole('img', { name: /검증 쌀죽/ })
    await expect(image).toBeVisible()
    await expect
      .poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
      .toBeGreaterThan(0)
    const photo = (await exported(data)).data.photos[0]
    const publicUrl = data.client.storage.from('recipe-photos').getPublicUrl(photo.storage_path)
      .data.publicUrl
    expect((await another.request.get(publicUrl)).ok()).toBe(false)
  } finally {
    await another.close()
  }
  const before = await state(data, id)
  await meal(page, day())
  await page.getByRole('searchbox', { name: '식단에 넣을 레시피 검색' }).fill('검증 쌀죽')
  await page
    .getByRole('list', { name: '레시피 검색 결과' })
    .getByRole('button', { name: '검증 쌀죽', exact: true })
    .click()
  await save(page)
  await expect(page.getByRole('alertdialog')).toContainText('검증 주의쌀')
  await page.getByRole('alertdialog').getByRole('button', { name: '취소', exact: true }).click()
  expect((await exported(data)).data.meal_entries).toHaveLength(0)
  await save(page)
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: '그래도 저장', exact: true })
    .click()
  await closed(page)
  expect(await state(data, id)).toEqual(before)
  await page.goto(`/meals/recipes/${recipe.id}/edit`)
  await page.getByLabel('레시피 이름', { exact: true }).fill('검증 쌀죽 수정')
  await save(page)
  await expect(page.getByRole('heading', { name: '검증 쌀죽 수정', exact: true })).toBeVisible()
  await page.goto(`/meals/recipes/${recipe.id}/edit`)
  await deleteRecord(page)
  await expect.poll(async () => (await exported(data)).data.recipes.length).toBe(0)
})

test('백업: 내려받기·잘못된 파일 차단·취소·전체 복원과 사진 없음', async ({ page, data }) => {
  const fixture = exampleBackup(data.owner)
  await replace(data, fixture)
  await page.goto('/settings')
  const backup = page.getByRole('region', { name: '데이터 백업', exact: true })
  const waiting = page.waitForEvent('download')
  await backup.getByRole('button', { name: '데이터 내보내기', exact: true }).click()
  const download = await waiting
  expect(download.suggestedFilename()).toMatch(/^baby-growth-backup-\d{8}\.json$/)
  const downloaded = JSON.parse(await readFile((await download.path())!, 'utf8'))
  expect(isDeepStrictEqual(downloaded.data, (await exported(data)).data)).toBe(true)
  await backup
    .getByLabel('가져올 백업 파일')
    .setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{') })
  await expect(backup.getByRole('alert')).toBeVisible()
  expect(isDeepStrictEqual((await exported(data)).data, downloaded.data)).toBe(true)
  downloaded.data.children[0].nickname = '복원한검증아기'
  await backup.getByLabel('가져올 백업 파일').setInputFiles({
    name: 'restore.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(downloaded)),
  })
  await backup.getByRole('button', { name: '이 백업으로 가져오기', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: '취소', exact: true }).click()
  expect((await exported(data)).data.children[0].nickname).toBe('백업예시아기')
  await backup.getByRole('button', { name: '이 백업으로 가져오기', exact: true }).click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: '전체 바꾸고 가져오기', exact: true })
    .click()
  await expect(page).toHaveURL('http://127.0.0.1:4173/')
  expect(isDeepStrictEqual((await exported(data)).data, downloaded.data)).toBe(true)
  await page.goto(`/meals/recipes/${fixture.data.recipes[0].id}`)
  await expect(page.getByText('사진 없음', { exact: false })).toBeVisible()
})

test('전체 삭제: 정확한 문구·취소, 연결 사진과 고아 파일 삭제, 로그인 유지', async ({
  page,
  data,
}) => {
  const fixture = exampleBackup(data.owner)
  await replace(data, fixture)
  const jpeg = await readFile('tests/fixtures/photo.jpg')
  for (const id of [fixture.data.photos[0].id, crypto.randomUUID()]) {
    const result = await data.client.storage
      .from('recipe-photos')
      .upload(`${data.owner}/${id}.jpg`, jpeg, { contentType: 'image/jpeg' })
    if (result.error) throw new Error('가명 삭제 검증 사진 준비 실패')
  }
  await page.goto('/settings')
  const section = page.getByRole('region', { name: '데이터 전체 삭제', exact: true })
  await section.getByRole('button', { name: '데이터 전체 삭제', exact: true }).click()
  let dialog = page.getByRole('alertdialog')
  const keyword = page.getByLabel('확인을 위해 ‘삭제’를 입력해 주세요')
  await expect(dialog.getByRole('button', { name: '모두 삭제', exact: true })).toBeDisabled()
  await keyword.fill('삭제 ')
  await expect(dialog.getByRole('button', { name: '모두 삭제', exact: true })).toBeDisabled()
  await keyword.fill('삭제')
  await dialog.getByRole('button', { name: '취소', exact: true }).click()
  expect((await exported(data)).data.recipes).toHaveLength(1)
  await section.getByRole('button', { name: '데이터 전체 삭제', exact: true }).click()
  dialog = page.getByRole('alertdialog')
  await expect(keyword).toHaveValue('')
  await keyword.fill('삭제')
  await dialog.getByRole('button', { name: '모두 삭제', exact: true }).click()
  await expect(page).toHaveURL(/\/setup$/)
  expect(Object.values((await exported(data)).data).every((rows) => rows.length === 0)).toBe(true)
  const files = await data.client.storage.from('recipe-photos').list(data.owner)
  if (files.error) throw new Error('삭제 후 사진 목록 확인 실패')
  expect(files.data).toHaveLength(0)
  await page.reload()
  await expect(page).toHaveURL(/\/setup$/)
})
