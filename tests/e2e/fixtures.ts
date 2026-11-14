import { test as base, expect, type BrowserContext } from '@playwright/test'
import { emptyBackup } from '../../src/test/backupFixture.ts'
import { exported, lock, login, preserve, replace, restore, type Data } from './data.ts'
import { e2eEnvironment } from './environment.ts'

export { expect, exported }
export const birthDate = '2026-01-08'
export function day(offset = 0) {
  const now = new Date()
  const korea = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  korea.setDate(korea.getDate() + offset)
  return `${korea.getFullYear()}-${String(korea.getMonth() + 1).padStart(2, '0')}-${String(korea.getDate()).padStart(2, '0')}`
}
export function labelDate(date: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'Asia/Seoul',
  }).format(new Date(`${date}T12:00:00+09:00`))
}
export async function authenticate(context: BrowserContext, data: Data) {
  const key = `sb-${e2eEnvironment().E2E_DEV_PROJECT_REF}-auth-token`
  await context.addInitScript(
    ({ key, session }) => localStorage.setItem(key, JSON.stringify(session)),
    {
      key,
      session: data.session,
    },
  )
}

export const test = base.extend<{ data: Data }, { account: Data }>({
  account: [
    // Playwright는 의존성이 없는 worker fixture에도 객체 구조 분해를 요구한다.
    // eslint-disable-next-line no-empty-pattern
    async ({}, provide) => {
      const unlock = await lock()
      let data: Data | undefined
      let preserved = false
      try {
        data = await login()
        await preserve(data)
        preserved = true
        await provide(data)
      } finally {
        try {
          if (data && preserved) await restore(data)
        } finally {
          if (data) await data.client.auth.signOut({ scope: 'local' })
          await unlock()
        }
      }
    },
    { scope: 'worker', timeout: 120_000 },
  ],
  data: async ({ account }, provide) => {
    const backup = emptyBackup(account.owner)
    backup.data.children = [
      {
        id: crypto.randomUUID(),
        nickname: '자동검증아기',
        birth_date: birthDate,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]
    await replace(account, backup)
    await provide(account)
  },
  context: async ({ context, data }, provide) => {
    await authenticate(context, data)
    // 모션 종료를 기다리는 Radix 시트와 스크롤이 작은 화면에서 경쟁하지 않게 한다.
    await context.addInitScript(() =>
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style')
        style.textContent =
          '*,*::before,*::after{animation:none!important;transition:none!important}'
        document.head.append(style)
      }),
    )
    await provide(context)
  },
  page: async ({ page }, provide) => {
    const errors: string[] = []
    page.on('pageerror', () => errors.push('브라우저 실행 오류'))
    await provide(page)
    expect(errors).toEqual([])
  },
})
