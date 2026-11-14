import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BackupSection } from './BackupSection'
import {
  BackupError,
  downloadBackup,
  exportBackup,
  importBackup,
  readBackupFile,
} from '@/lib/backupApi'
import { emptyBackup, exampleBackup } from '@/test/backupFixture'
vi.mock('@/lib/backupApi', async (original) => ({
  ...(await original<typeof import('@/lib/backupApi')>()),
  downloadBackup: vi.fn(),
  exportBackup: vi.fn(),
  importBackup: vi.fn(),
  readBackupFile: vi.fn(),
}))
const payload = exampleBackup()
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(exportBackup).mockResolvedValue(payload)
  vi.mocked(readBackupFile).mockResolvedValue(payload)
})
function open() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['old-data'], ['private-old-value'])
  const router = createMemoryRouter(
    [
      { path: '/settings', element: <BackupSection /> },
      { path: '/', element: <p>복원된 홈</p> },
      { path: '/setup', element: <p>아이 등록</p> },
    ],
    { initialEntries: ['/settings'] },
  )
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { client, router }
}
const choose = async () =>
  userEvent.upload(
    screen.getByLabelText('가져올 백업 파일'),
    new File(['{}'], '백업.json', { type: 'application/json' }),
  )
describe('설정 백업·복원', () => {
  it('내보내기를 누르면 백업을 내려받는다', async () => {
    open()
    await userEvent.click(screen.getByRole('button', { name: '데이터 내보내기' }))
    await waitFor(() => expect(downloadBackup).toHaveBeenCalledWith(payload))
  })
  it('파일 검사·요약 뒤 확인을 취소하면 서버 데이터를 바꾸지 않는다', async () => {
    open()
    await choose()
    expect(await screen.findByText('백업 내용')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '이 백업으로 가져오기' }))
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveTextContent('현재 데이터가 모두 지워지고')
    await userEvent.click(within(dialog).getByRole('button', { name: '취소' }))
    expect(importBackup).not.toHaveBeenCalled()
    expect(screen.getByText('백업.json')).toBeInTheDocument()
  })
  it('파일 검사 실패는 가져오기를 제공하지 않는다', async () => {
    vi.mocked(readBackupFile).mockRejectedValueOnce(new BackupError('newerVersion'))
    open()
    await choose()
    expect(await screen.findByRole('alert')).toHaveTextContent('현재 앱보다 높은 버전')
    expect(screen.queryByRole('button', { name: '이 백업으로 가져오기' })).not.toBeInTheDocument()
    expect(importBackup).not.toHaveBeenCalled()
  })
  it('성공하면 예전 캐시를 비우고 홈으로 이동한다', async () => {
    const { client, router } = open()
    await choose()
    await screen.findByText('백업 내용')
    await userEvent.click(screen.getByRole('button', { name: '이 백업으로 가져오기' }))
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: '전체 바꾸고 가져오기' }),
    )
    await screen.findByText('복원된 홈')
    expect(client.getQueryData(['old-data'])).toBeUndefined()
    expect(router.state.location.pathname).toBe('/')
  })
  it('서버 검사 실패는 선택을 유지하고 재시도도 다시 확인받는다', async () => {
    vi.mocked(importBackup).mockRejectedValueOnce(new BackupError('invalid'))
    open()
    await choose()
    await screen.findByText('백업 내용')
    await userEvent.click(screen.getByRole('button', { name: '이 백업으로 가져오기' }))
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: '전체 바꾸고 가져오기' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('기존 데이터는 유지')
    expect(screen.getByText('백업.json')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(importBackup).toHaveBeenCalledTimes(1)
  })
  it('복원 중에는 파일·취소·내보내기·중복 가져오기를 잠근다', async () => {
    let finish!: () => void
    vi.mocked(importBackup).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    open()
    await choose()
    await screen.findByText('백업 내용')
    await userEvent.click(screen.getByRole('button', { name: '이 백업으로 가져오기' }))
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: '전체 바꾸고 가져오기' }),
    )
    expect(screen.getByRole('button', { name: '가져오는 중…' })).toBeDisabled()
    expect(screen.getByLabelText('가져올 백업 파일')).toBeDisabled()
    expect(screen.getByRole('button', { name: '데이터 내보내기' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '파일 선택 취소' })).toBeDisabled()
    expect(importBackup).toHaveBeenCalledTimes(1)
    await act(async () => finish())
    await screen.findByText('복원된 홈')
  })
  it('아이 정보가 없는 빈 백업은 복원 후 등록 화면으로 이동한다', async () => {
    vi.mocked(readBackupFile).mockResolvedValueOnce(emptyBackup())
    open()
    await choose()
    await screen.findByText('백업 내용')
    await userEvent.click(screen.getByRole('button', { name: '이 백업으로 가져오기' }))
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: '전체 바꾸고 가져오기' }),
    )
    await screen.findByText('아이 등록')
  })
})
