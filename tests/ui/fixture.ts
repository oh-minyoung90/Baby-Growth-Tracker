import assert from 'node:assert/strict'
import type { Page } from '@playwright/test'

export const fixtureChild = {
  id: '00000000-0000-4000-8000-000000000001',
  nickname: '가명아기',
  birth_date: '2026-01-08',
}

/** 실제 폼·라우트를 사용하고 인증·DB 응답만 가명 데이터로 대체한다. */
export async function prepareFixturePage(
  page: Page,
  path: string,
  responses: Record<string, unknown>,
) {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.origin === 'http://127.0.0.1:4180') return route.continue()
    if (url.origin !== 'https://ui-fixture.supabase.test') return route.abort()
    assert.equal(
      route.request().method(),
      'GET',
      'UI 검사에서는 쓰기·실제 로그인을 수행하지 않는다',
    )
    const data = responses[url.pathname]
    assert.ok(data, '정의하지 않은 API 요청은 검사용 응답으로 숨기지 않는다')
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data),
    })
  })
  await page.addInitScript(() => {
    localStorage.setItem(
      'sb-ui-fixture-auth-token',
      JSON.stringify({
        access_token: 'ui-fake-token',
        refresh_token: 'ui-fake-refresh',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
        user: {
          id: '00000000-0000-4000-8000-000000000002',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'fixture@example.test',
        },
      }),
    )
  })
  await page.goto(path)
}
