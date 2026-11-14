import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DeleteAllSection } from './DeleteAllSection'
import { deleteAllData, DeleteAllDataError } from '@/lib/deleteAllDataApi'
import { downloadBackup, exportBackup } from '@/lib/backupApi'
import { exampleBackup } from '@/test/backupFixture'
vi.mock('@/lib/deleteAllDataApi', async (original) => ({
  ...(await original<typeof import('@/lib/deleteAllDataApi')>()),
  deleteAllData: vi.fn(),
}))
vi.mock('@/lib/backupApi', async (original) => ({
  ...(await original<typeof import('@/lib/backupApi')>()),
  exportBackup: vi.fn(),
  downloadBackup: vi.fn(),
}))
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(exportBackup).mockResolvedValue(exampleBackup())
})
function open() {
  const client = new QueryClient()
  client.setQueryData(['old-data'], ['private-old'])
  const onBusy = vi.fn()
  const router = createMemoryRouter(
    [
      { path: '/settings', element: <DeleteAllSection onBusyChange={onBusy} /> },
      { path: '/setup', element: <p>아이 정보 등록</p> },
    ],
    { initialEntries: ['/settings'] },
  )
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { client, router, onBusy }
}
const show = async () => {
  await userEvent.click(screen.getByRole('button', { name: '데이터 전체 삭제' }))
  return screen.getByRole('alertdialog')
}
describe('전체 삭제 확인·실패·완료', () => {
  it('먼저 백업을 안내하고 다운로드할 수 있다', async () => {
    open()
    expect(screen.getByText('삭제 전에 데이터를 내보내 두세요')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '삭제 전 백업 내려받기' }))
    await waitFor(() => expect(downloadBackup).toHaveBeenCalledOnce())
    expect(deleteAllData).not.toHaveBeenCalled()
  })
  it('정확한 삭제 입력 전에는 실행하지 않고 취소 시 삭제하지 않는다', async () => {
    open()
    const dialog = await show()
    const submit = within(dialog).getByRole('button', { name: '모두 삭제' })
    expect(submit).toBeDisabled()
    await userEvent.type(screen.getByLabelText('확인을 위해 ‘삭제’를 입력해 주세요'), '삭제 ')
    expect(submit).toBeDisabled()
    await userEvent.clear(screen.getByLabelText('확인을 위해 ‘삭제’를 입력해 주세요'))
    await userEvent.type(screen.getByLabelText('확인을 위해 ‘삭제’를 입력해 주세요'), '삭제')
    expect(submit).toBeEnabled()
    await userEvent.click(within(dialog).getByRole('button', { name: '취소' }))
    expect(deleteAllData).not.toHaveBeenCalled()
    await show()
    expect(screen.getByLabelText('확인을 위해 ‘삭제’를 입력해 주세요')).toHaveValue('')
  })
  it('삭제 중 취소·입력·중복 실행·Escape를 막고 성공하면 캐시를 비우고 등록으로 이동한다', async () => {
    let finish!: () => void
    vi.mocked(deleteAllData).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const { client, onBusy } = open()
    const dialog = await show()
    await userEvent.type(screen.getByLabelText('확인을 위해 ‘삭제’를 입력해 주세요'), '삭제')
    await userEvent.click(within(dialog).getByRole('button', { name: '모두 삭제' }))
    expect(screen.getByRole('button', { name: '삭제하는 중…' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: '취소' })).toBeDisabled()
    expect(screen.getByLabelText('확인을 위해 ‘삭제’를 입력해 주세요')).toBeDisabled()
    await userEvent.keyboard('{Escape}')
    expect(dialog).toBeInTheDocument()
    expect(deleteAllData).toHaveBeenCalledTimes(1)
    expect(onBusy).toHaveBeenCalledWith(true)
    await act(async () => finish())
    await screen.findByText('아이 정보 등록')
    expect(client.getQueryData(['old-data'])).toBeUndefined()
  })
  it('사진 정리 실패는 완료로 표시하지 않고 같은 확인 창에서 재시도한다', async () => {
    vi.mocked(deleteAllData).mockRejectedValueOnce(new DeleteAllDataError('photos'))
    const { client, router } = open()
    const dialog = await show()
    await userEvent.type(screen.getByLabelText('확인을 위해 ‘삭제’를 입력해 주세요'), '삭제')
    await userEvent.click(within(dialog).getByRole('button', { name: '모두 삭제' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('일부 사진은 이미 삭제')
    expect(router.state.location.pathname).toBe('/settings')
    expect(client.getQueryData(['old-data'])).toBeDefined()
    await userEvent.click(within(dialog).getByRole('button', { name: '다시 삭제 시도' }))
    await screen.findByText('아이 정보 등록')
    expect(deleteAllData).toHaveBeenCalledTimes(2)
  })
  it('입력칸의 Enter도 한 번만 실행한다', async () => {
    open()
    await show()
    await userEvent.type(screen.getByLabelText('확인을 위해 ‘삭제’를 입력해 주세요'), '삭제{enter}')
    await screen.findByText('아이 정보 등록')
    expect(deleteAllData).toHaveBeenCalledTimes(1)
  })
})
