import { MessageCircle } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { AddRecordButton } from '@/components/AddRecordButton'
import { ChoiceChips } from '@/components/ChoiceChips'
import { EmptyState } from '@/components/EmptyState'
import { ErrorBanner } from '@/components/ErrorBanner'
import { ListLoading } from '@/components/ListLoading'
import { ageLabel } from '@/domain/age'
import { formatDateLabel } from '@/domain/date'
import { NETWORK_ERROR_MESSAGES } from '@/lib/messages'
import { useChild } from '@/lib/useChild'
import type { Milestone } from '@/lib/milestoneApi'
import { useMilestones } from '@/lib/useMilestones'
import { WORD_SORTS, firstWords, sortWords, type WordSort } from './words'

/** 단어가 골라진 상태로 발달 기록 입력 화면을 연다 (FR-WORD-03) */
const NEW_WORD_PATH = '/milestones/new?type=word'

/**
 * 성장 > 단어 (SCR-06, FR-WORD-01~03): 말할 수 있는 단어 수, 정렬, 단어 목록.
 * 같은 단어(BR-03)를 여러 번 기록했으면 처음 기록한 것 하나만 보여 주고 1개로 센다.
 * 정렬은 주소(?sort=name)에 두어 수정 화면에 갔다 돌아와도 유지한다
 */
export function WordsPage() {
  const { data: child } = useChild()
  const milestones = useMilestones()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const sort: WordSort = params.get('sort') === 'name' ? 'name' : 'recent'

  if (milestones.isPending) return <ListLoading />
  if (milestones.isError) {
    return (
      <ErrorBanner
        message={NETWORK_ERROR_MESSAGES.load}
        onRetry={() => void milestones.refetch()}
        retrying={milestones.isFetching}
      />
    )
  }

  const words = firstWords(milestones.data)
  if (words.length === 0) {
    return (
      <EmptyState
        icon={MessageCircle}
        title="아직 기록한 단어가 없어요"
        description="아이가 말한 단어를 기록하면 여기에 모아 볼 수 있어요"
        to={NEW_WORD_PATH}
      />
    )
  }

  return (
    // 모바일에서 떠 있는 추가 버튼이 마지막 단어를 가리지 않게 아래를 비운다
    <div className="flex flex-col gap-3.5 pb-20 md:pb-0">
      <section className="flex items-center justify-between rounded-card bg-primary p-[18px] text-primary-foreground">
        <p className="flex flex-col gap-0.5">
          <span className="text-sm opacity-90">말할 수 있는 단어</span>
          <strong className="text-[30px] leading-tight tracking-[-0.5px]">{words.length}개</strong>
        </p>
        <MessageCircle className="size-10" strokeWidth={1.8} aria-hidden />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="text-sm text-muted-foreground">같은 단어는 1개로 셉니다</p>
        <div className="flex items-center gap-3">
          <ChoiceChips
            label="정렬"
            options={WORD_SORTS}
            value={sort}
            onChange={(next) => setParams(next === 'name' ? { sort: next } : {}, { replace: true })}
          />
          <AddRecordButton label="단어 추가" onClick={() => void navigate(NEW_WORD_PATH)} />
        </div>
      </div>

      <WordList words={sortWords(words, sort)} birthDate={child?.birthDate} />
    </div>
  )
}

/** 단어, 처음 기록한 날짜, 그날의 생후 일수 (FR-WORD-02). 누르면 처음 기록한 기록의 수정 화면 (FR-COM-30) */
function WordList({ words, birthDate }: { words: Milestone[]; birthDate: string | undefined }) {
  return (
    <ul className="divide-y overflow-hidden rounded-card border bg-surface">
      {words.map((word) => {
        const age = ageLabel(birthDate, word.date)
        return (
          <li key={word.id}>
            <Link
              to={`/milestones/${word.id}`}
              className="flex min-h-13 items-center justify-between gap-3 px-4 py-2.5 transition-colors outline-none hover:bg-muted focus-visible:bg-muted"
            >
              <span className="min-w-0 font-medium break-words">{word.title}</span>
              {/* 모바일은 날짜와 생후 일수를 두 줄로, PC는 한 줄로 */}
              <span className="flex shrink-0 flex-col items-end text-[13px] text-muted-foreground md:flex-row md:gap-1">
                <span>{formatDateLabel(word.date)}</span>
                {age && <span className="md:before:content-['·_']">{age}</span>}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
