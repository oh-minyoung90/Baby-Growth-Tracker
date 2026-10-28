import { History, Plus } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { ErrorBanner } from '@/components/ErrorBanner'
import { ListLoading } from '@/components/ListLoading'
import { Page } from '@/components/Page'
import { Button } from '@/components/ui/button'
import { todayString } from '@/domain/date'
import { NETWORK_ERROR_MESSAGES } from '@/lib/messages'
import { useBodyMeasures } from '@/lib/useBodyMeasures'
import { useChild } from '@/lib/useChild'
import { useMilestones } from '@/lib/useMilestones'
import {
  DEFAULT_FILTER,
  buildTimeline,
  filterTimeline,
  filterToParams,
  parseFilter,
  type TimelineFilter,
} from './timeline'
import { TimelineFilters } from './TimelineFilters'
import { TimelineList } from './TimelineList'

const NEW_MILESTONE_PATH = '/milestones/new'

/**
 * 타임라인 (SCR-07, FR-TL-01~05, 07): 발달 기록과 키·몸무게 측정을 날짜 최신순으로, 월별로 묶어 보여 준다.
 * 필터는 주소에 두어 기록을 열었다 돌아와도 유지한다.
 */
export function TimelinePage() {
  return (
    <Page
      title="타임라인"
      actions={
        // 모바일은 홈의 빠른 기록에서 입력한다 (시안 D-04)
        <Button asChild className="hidden md:inline-flex">
          <Link to={NEW_MILESTONE_PATH}>
            <Plus aria-hidden />
            발달 기록
          </Link>
        </Button>
      }
    >
      <TimelineContent />
    </Page>
  )
}

function TimelineContent() {
  const { data: child } = useChild()
  const milestones = useMilestones()
  const measures = useBodyMeasures()
  const [params, setParams] = useSearchParams()

  // 한쪽이라도 불러오지 못했으면 다른 쪽을 기다리지 않고 안내한다
  const failed = milestones.isError || measures.isError
  if (!failed && (milestones.isPending || measures.isPending)) return <ListLoading />
  if (failed) {
    return (
      <ErrorBanner
        message={NETWORK_ERROR_MESSAGES.load}
        onRetry={() => {
          if (milestones.isError) void milestones.refetch()
          if (measures.isError) void measures.refetch()
        }}
        retrying={milestones.isFetching || measures.isFetching}
      />
    )
  }

  const items = buildTimeline(milestones.data ?? [], measures.data ?? [])
  if (items.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="아직 기록이 없어요"
        description="발달 기록과 키·몸무게를 기록하면 여기에 날짜순으로 모여요"
        to={NEW_MILESTONE_PATH}
      />
    )
  }

  const filter = parseFilter(params)
  const setFilter = (next: TimelineFilter) => setParams(filterToParams(next), { replace: true })
  const shown = filterTimeline(items, filter, todayString())

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
      <TimelineFilters filter={filter} onChange={setFilter} birthDate={child?.birthDate} />
      <div className="min-w-0 flex-1">
        {shown.length > 0 ? (
          <TimelineList items={shown} birthDate={child?.birthDate} />
        ) : (
          // 필터 결과 없음 (FR-TL-05)
          <section className="flex flex-col items-center gap-3 py-12 text-center">
            <strong className="text-[17px]">조건에 맞는 기록이 없어요</strong>
            <Button type="button" variant="outline" onClick={() => setFilter(DEFAULT_FILTER)}>
              필터 초기화
            </Button>
          </section>
        )}
      </div>
    </div>
  )
}
