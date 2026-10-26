import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Milestone } from 'lucide-react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { Toaster } from '@/components/ui/sonner'
import { notifySaved } from '@/lib/notify'
import { EmptyState } from './EmptyState'
import { ErrorBanner } from './ErrorBanner'
import { ListLoading } from './ListLoading'

// 저장 알림, 네트워크 오류, 빈 상태, 로딩 (기능요구사항서 3.4, 3.5)

describe('저장 알림', () => {
  it('"저장했어요"를 보여 준다', async () => {
    render(<Toaster />)
    notifySaved()
    expect(await screen.findByText('저장했어요')).toBeInTheDocument()
  })
})

describe('ErrorBanner', () => {
  it('기본 문구와 다시 시도 버튼을 보여 준다', async () => {
    const onRetry = vi.fn()
    render(<ErrorBanner onRetry={onRetry} />)
    expect(screen.getByRole('alert')).toHaveTextContent(
      '저장하지 못했어요. 인터넷 연결을 확인해 주세요',
    )
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('다시 시도하는 중에는 버튼을 잠근다', () => {
    render(<ErrorBanner onRetry={vi.fn()} retrying />)
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeDisabled()
  })
})

describe('EmptyState', () => {
  it('안내 문구와 기록하기 버튼을 보여 준다 (버튼으로 동작)', async () => {
    const onAction = vi.fn()
    render(<EmptyState icon={Milestone} title="아직 기록이 없어요" onAction={onAction} />)
    expect(screen.getByText('아직 기록이 없어요')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '기록하기' }))
    expect(onAction).toHaveBeenCalledOnce()
  })

  it('화면 이동 버튼으로도 쓸 수 있다', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <EmptyState icon={Milestone} title="아직 기록이 없어요" to="/new" />,
        },
        { path: '/new', element: <p>입력 화면</p> },
      ],
      { initialEntries: ['/'] },
    )
    render(<RouterProvider router={router} />)
    await userEvent.click(screen.getByRole('link', { name: '기록하기' }))
    expect(router.state.location.pathname).toBe('/new')
  })
})

describe('ListLoading', () => {
  it('목록 자리에 불러오는 중을 알린다', () => {
    render(<ListLoading />)
    expect(screen.getByRole('status')).toHaveTextContent('불러오는 중')
  })
})
