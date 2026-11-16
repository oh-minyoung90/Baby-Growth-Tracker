import { render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { reportUnexpectedError, safeRootErrors } from '@/lib/reportUnexpectedError'
import { RouteError } from './RouteError'

afterEach(() => vi.restoreAllMocks())

describe('화면 오류에 개인정보를 남기지 않는다', () => {
  it.each(['render', 'loader'] as const)('%s 오류는 일반 안내로 표시·기록한다', async (where) => {
    const marker = '가명아이 생년월일 2026-01-08 사진 signed-token-example'
    const failure = new Error(marker, { cause: { nickname: marker } })
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    function FailingPage(): never {
      throw failure
    }
    const router = createMemoryRouter([
      {
        path: '/',
        element: where === 'render' ? <FailingPage /> : <p>기록 화면</p>,
        loader: where === 'loader' ? () => Promise.reject(failure) : undefined,
        HydrateFallback: () => null,
        errorElement: <RouteError />,
      },
    ])
    render(<RouterProvider router={router} onError={reportUnexpectedError} />, {
      onCaughtError: safeRootErrors.onCaughtError,
      onRecoverableError: safeRootErrors.onRecoverableError,
    })
    expect(await screen.findByRole('heading', { name: '문제가 생겼어요' })).toBeVisible()
    expect(screen.getByRole('link', { name: '홈으로' })).toHaveAttribute('href', '/')
    await waitFor(() => expect(logged).toHaveBeenCalled())
    // 실제 Router·React 오류 경계를 통과한 결과를 검사한다. 원본 Error/cause도 출력하지 않는다.
    expect(logged.mock.calls.flat().every((item) => typeof item === 'string')).toBe(true)
    expect(JSON.stringify(logged.mock.calls)).not.toContain(marker)
    expect(document.body.textContent).not.toContain(marker)
    router.dispose()
  })
})
