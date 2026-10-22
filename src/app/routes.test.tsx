import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthState } from '@/lib/auth'
import { fetchMyChild } from '@/lib/childApi'
import { renderApp } from '@/test/renderApp'

// 화면 이동과 로그인 여부에 따른 이동 (T-09, FR-AUTH-06)

const signedIn: AuthState = { status: 'signedIn', session: { user: { id: 'test' } } as Session }
const signedOut: AuthState = { status: 'signedOut', session: null }

vi.mock('@/lib/childApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/childApi')>()),
  fetchMyChild: vi.fn(),
  saveChild: vi.fn(),
}))
const mockedFetchChild = vi.mocked(fetchMyChild)

beforeEach(() => {
  mockedFetchChild.mockReset()
  mockedFetchChild.mockResolvedValue({ id: 'c1', nickname: '하늘이', birthDate: '2026-01-08' })
})

function renderAt(path: string, auth: AuthState = signedIn) {
  return renderApp(path, auth).router
}

describe('로그인 여부에 따른 이동', () => {
  it('로그인하지 않으면 로그인 화면으로 보낸다', async () => {
    const router = renderAt('/growth/sleep', signedOut)
    expect(await screen.findByRole('button', { name: '인증 코드 받기' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('로그인 상태를 확인하는 동안에는 불러오는 중을 보여 준다', () => {
    renderAt('/', { status: 'loading', session: null })
    expect(screen.getByRole('status')).toHaveTextContent('불러오는 중')
  })

  it('이미 로그인했으면 로그인 화면 대신 홈으로 보낸다', async () => {
    const router = renderAt('/login')
    expect(await screen.findByRole('heading', { level: 1, name: '홈' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })
})

describe('로그인 후 원래 가려던 화면으로 이동', () => {
  function renderLoginWithFrom(from: string) {
    return renderApp({ pathname: '/login', state: { from } }, signedIn).router
  }

  it('앱 안의 주소면 그 화면으로 보낸다', async () => {
    const router = renderLoginWithFrom('/growth/sleep')
    await screen.findByRole('heading', { level: 1, name: '성장' })
    expect(router.state.location.pathname).toBe('/growth/sleep')
  })

  it('외부 주소는 무시하고 홈으로 보낸다', async () => {
    const router = renderLoginWithFrom('//evil.example.com')
    await screen.findByRole('heading', { level: 1, name: '홈' })
    expect(router.state.location.pathname).toBe('/')
  })
})

describe('주 메뉴', () => {
  it('메뉴 5개가 있고 현재 화면이 선택 표시된다', async () => {
    renderAt('/timeline')
    await screen.findByRole('heading', { level: 1, name: '타임라인' })
    // 모바일 하단 탭과 PC 왼쪽 메뉴가 함께 있다 (화면 폭에 따라 하나만 보임)
    const navs = screen.getAllByRole('navigation', { name: '주 메뉴' })
    expect(navs).toHaveLength(2)
    for (const nav of navs) {
      const links = within(nav).getAllByRole('link')
      expect(links.map((l) => l.textContent?.trim())).toEqual([
        expect.stringContaining('홈'),
        '성장',
        '타임라인',
        '식사',
        '설정',
      ])
      expect(within(nav).getByRole('link', { name: '타임라인' })).toHaveAttribute(
        'aria-current',
        'page',
      )
      expect(within(nav).getByRole('link', { name: '홈' })).not.toHaveAttribute('aria-current')
    }
  })

  it('메뉴를 누르면 해당 화면으로 이동한다', async () => {
    const router = renderAt('/')
    const [nav] = await screen.findAllByRole('navigation', { name: '주 메뉴' })
    await userEvent.click(within(nav).getByRole('link', { name: '설정' }))
    expect(await screen.findByRole('heading', { level: 1, name: '설정' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/settings')
    expect(screen.getByRole('radiogroup', { name: '화면 모드' })).toBeInTheDocument()
  })
})

describe('화면 안 상단 탭', () => {
  it('성장 메뉴는 키·몸무게 탭으로 연다', async () => {
    const router = renderAt('/growth')
    const tabs = await screen.findByRole('navigation', { name: '성장 기록 종류' })
    expect(router.state.location.pathname).toBe('/growth/body')
    expect(within(tabs).getByRole('link', { name: '키·몸무게' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('식사 메뉴는 주간 식단 탭으로 열고, 탭을 바꿀 수 있다', async () => {
    const router = renderAt('/meals')
    const tabs = await screen.findByRole('navigation', { name: '식사 화면' })
    expect(router.state.location.pathname).toBe('/meals/week')
    await userEvent.click(within(tabs).getByRole('link', { name: '레시피' }))
    expect(router.state.location.pathname).toBe('/meals/recipes')
  })
})

describe('없는 주소', () => {
  it('페이지를 찾을 수 없다고 안내한다', async () => {
    renderAt('/no-such-page')
    expect(await screen.findByText('페이지를 찾을 수 없어요')).toBeInTheDocument()
  })
})

describe('브라우저 탭 제목', () => {
  it('화면 이름으로 바뀐다', async () => {
    renderAt('/settings')
    await screen.findByRole('heading', { level: 1, name: '설정' })
    expect(document.title).toBe('설정 · Baby Growth Tracker')
  })
})

describe('아이 정보 등록 여부에 따른 이동 (FR-CHILD-01)', () => {
  it('아이 정보가 없으면 어느 화면을 열어도 등록 화면으로 보낸다', async () => {
    mockedFetchChild.mockResolvedValue(null)
    const router = renderAt('/timeline')
    expect(await screen.findByRole('heading', { name: /아이 정보를/ })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/setup')
    // 등록 화면에는 메뉴가 없어 다른 화면으로 갈 수 없다
    expect(screen.queryByRole('navigation', { name: '주 메뉴' })).not.toBeInTheDocument()
  })

  it('이미 등록했으면 등록 화면 대신 홈으로 보낸다', async () => {
    const router = renderAt('/setup')
    expect(await screen.findByRole('heading', { level: 1, name: '홈' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('아이 정보를 불러오지 못하면 다시 시도할 수 있다', async () => {
    mockedFetchChild.mockRejectedValue(new Error('network'))
    renderAt('/')
    expect(await screen.findByRole('alert')).toHaveTextContent('정보를 불러오지 못했어요')
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
  })
})
