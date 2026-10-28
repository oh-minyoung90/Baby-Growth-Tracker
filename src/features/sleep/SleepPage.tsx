import { useNavigate } from 'react-router'
import { AddRecordButton } from '@/components/AddRecordButton'
import { Page } from '@/components/Page'
import { Placeholder } from '@/components/Placeholder'

/** 수면 (SCR-08): 주 메뉴의 수면 탭 (R1). 추가 버튼은 수면 입력 화면을 연다 */
export function SleepPage() {
  const navigate = useNavigate()
  return (
    <Page
      title="수면"
      actions={
        <AddRecordButton label="수면 기록 추가" onClick={() => void navigate('/sleep/new')} />
      }
    >
      <Placeholder task="T-27" description="수면 목록" />
    </Page>
  )
}
