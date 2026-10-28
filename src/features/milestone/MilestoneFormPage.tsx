import { useParams, useSearchParams } from 'react-router'
import { ErrorBanner } from '@/components/ErrorBanner'
import { FormPage } from '@/components/FormPage'
import { ListLoading } from '@/components/ListLoading'
import { NETWORK_ERROR_MESSAGES } from '@/lib/messages'
import { isMilestoneType } from '@/lib/milestoneTypes'
import { useChild } from '@/lib/useChild'
import { useGoBack } from '@/lib/useGoBack'
import { MilestoneForm } from './MilestoneForm'
import { useMilestone } from '@/lib/useMilestones'

/**
 * 발달 기록 입력·수정 화면 (SCR-05).
 * - /milestones/new?type=word: 새 기록. type이 있으면 그 유형을 고른 상태로 연다 (FR-MS-01)
 * - /milestones/:id: 수정
 * 저장·취소하면 진입했던 화면으로 돌아간다 (FR-MS-07). 이 주소로 바로 들어왔으면 단어는 단어 목록, 나머지는 타임라인으로
 */
export function MilestoneFormPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { data: child } = useChild()
  const milestone = useMilestone(id)

  const typeParam = params.get('type')
  const defaultType = isMilestoneType(typeParam) ? typeParam : undefined
  const type = milestone.data?.type ?? defaultType
  const goBack = useGoBack(type === 'word' ? '/growth/words' : '/timeline')

  return (
    <FormPage title={id ? '발달 기록 수정' : '발달 기록'} onBack={goBack}>
      {id && milestone.isPending ? (
        <ListLoading />
      ) : id && milestone.isError ? (
        <ErrorBanner
          message={NETWORK_ERROR_MESSAGES.load}
          onRetry={() => void milestone.refetch()}
          retrying={milestone.isFetching}
        />
      ) : id && !milestone.data ? (
        <p className="py-10 text-center text-muted-foreground">
          기록을 찾을 수 없어요. 이미 삭제한 기록일 수 있어요
        </p>
      ) : (
        child && (
          <MilestoneForm
            initial={milestone.data ?? undefined}
            defaultType={defaultType}
            birthDate={child.birthDate}
            onDone={goBack}
          />
        )
      )}
    </FormPage>
  )
}
