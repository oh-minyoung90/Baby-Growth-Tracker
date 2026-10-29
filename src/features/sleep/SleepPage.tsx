import { Moon } from 'lucide-react'
import { useNavigate } from 'react-router'
import { AddRecordButton } from '@/components/AddRecordButton'
import { EmptyState } from '@/components/EmptyState'
import { ErrorBanner } from '@/components/ErrorBanner'
import { ListLoading } from '@/components/ListLoading'
import { Page } from '@/components/Page'
import { NETWORK_ERROR_MESSAGES } from '@/lib/messages'
import { useSleepLogs } from '@/lib/useSleepLogs'
import { SleepList } from './SleepList'

/**
 * 수면 (SCR-08): 주 메뉴의 수면 탭 (R1). 수면 목록(FR-SLEEP-09)과 추가 버튼.
 * 추가 버튼과 목록의 기록은 수면 입력 화면(/sleep/new, /sleep/:id)을 연다
 */
export function SleepPage() {
  const navigate = useNavigate()
  const logs = useSleepLogs()

  return (
    <Page
      title="수면"
      actions={
        <AddRecordButton label="수면 기록 추가" onClick={() => void navigate('/sleep/new')} />
      }
    >
      {/* 모바일에서 떠 있는 추가 버튼이 마지막 기록을 가리지 않게 아래를 비운다 */}
      <div className="pb-20 md:pb-0">
        {logs.isPending ? (
          <ListLoading />
        ) : logs.isError ? (
          <ErrorBanner
            message={NETWORK_ERROR_MESSAGES.load}
            onRetry={() => void logs.refetch()}
            retrying={logs.isFetching}
          />
        ) : logs.data.length === 0 ? (
          <EmptyState
            icon={Moon}
            title="아직 수면 기록이 없어요"
            description="밤잠과 낮잠을 기록하면 하루 총 수면 시간을 볼 수 있어요"
            to="/sleep/new"
          />
        ) : (
          <SleepList logs={logs.data} />
        )}
      </div>
    </Page>
  )
}
