import { test, expect, exported } from './fixtures.ts'
import { replace } from './data.ts'

test('홈에서 아이 사진 등록·교체·삭제와 이전 백업 복원', async ({ page, data }) => {
  await page.goto('/')
  const edit = page.getByRole('link', { name: '아이 프로필 사진 편집' })
  const image = page.getByRole('img', { name: '아이 프로필 사진' })
  const file = page.getByLabel('아이 사진 파일')
  const save = page.getByRole('button', { name: '저장', exact: true })

  await edit.click()
  await file.setInputFiles('tests/fixtures/photo.jpg')
  await expect(image).toBeVisible()
  await save.click()
  await expect(edit).toBeVisible()
  await page.reload()
  await expect(image).toBeVisible()
  const snapshot = await exported(data)
  expect(snapshot.data.children[0].profile_photo?.startsWith('data:image/jpeg;base64,/9j/')).toBe(
    true,
  )

  await edit.click()
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 220
    return canvas.toDataURL('image/png').split(',')[1]
  })
  await file.setInputFiles({
    name: 'sample.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  })
  await expect
    .poll(async () => (await image.getAttribute('src')) !== snapshot.data.children[0].profile_photo)
    .toBe(true)
  await save.click()
  await expect(edit).toBeVisible()
  await page.reload()
  await expect(image).toBeVisible()
  expect(await image.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(192)

  await edit.click()
  await page.getByRole('button', { name: '사진 삭제' }).click()
  await save.click()
  await expect(edit).toBeVisible()
  expect((await exported(data)).data.children[0].profile_photo).toBeNull()
  await replace(data, snapshot)
  await page.reload()
  await expect(image).toBeVisible()
  delete snapshot.data.children[0].profile_photo
  await replace(data, snapshot)
  await page.reload()
  await expect(edit).toBeVisible()
  await expect(image).toHaveCount(0)
})
