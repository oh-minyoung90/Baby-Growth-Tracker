import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { ErrorBanner } from '@/components/ErrorBanner'
import { FormPage } from '@/components/FormPage'
import { ListLoading } from '@/components/ListLoading'
import { isValidDateString } from '@/domain/date'
import { NETWORK_ERROR_MESSAGES } from '@/lib/messages'
import type { SleepLog } from '@/lib/sleepApi'
import { useChild } from '@/lib/useChild'
import { useGoBack } from '@/lib/useGoBack'
import { useSleepLogs } from '@/lib/useSleepLogs'
import { SleepForm } from './SleepForm'
import { defaultSleepDate } from './sleepSchema'

const TITLE = { new: '수면 기록', edit: '수면 기록 수정' } as const

/**
 * 수면 입력·수정 화면 (SCR-08, FR-SLEEP-01~08).
 * - /sleep/new?date=YYYY-MM-DD: 새 기록. date가 없으면 수면일은 어제 (FR-SLEEP-01)
 * - /sleep/:id: 수정
 * 수면일당 1건이라 수면일로 기록을 찾는다. 저장·취소하면 진입했던 화면으로, 이 주소로 바로 들어왔으면 수면 목록으로 돌아간다
 */
export function SleepFormPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { data: child } = useChild()
  const logs = useSleepLogs()
  const goBack = useGoBack('/sleep')

  if (!child || logs.isPending || logs.isError) {
    return (
      <FormPage title={id ? TITLE.edit : TITLE.new} onBack={goBack}>
        {logs.isError ? (
          <ErrorBanner
            message={NETWORK_ERROR_MESSAGES.load}
            onRetry={() => void logs.refetch()}
            retrying={logs.isFetching}
          />
        ) : (
          <ListLoading />
        )}
      </FormPage>
    )
  }

  const opened = id ? logs.data.find((log) => log.id === id) : undefined
  if (id && !opened) {
    return (
      <FormPage title={TITLE.edit} onBack={goBack}>
        <p className="py-10 text-center text-muted-foreground">
          기록을 찾을 수 없어요. 이미 삭제한 기록일 수 있어요
        </p>
      </FormPage>
    )
  }

  const dateParam = params.get('date')
  return (
    <SleepEditor
      // 다른 기록을 열면 처음부터 다시 그린다
      key={id ?? 'new'}
      opened={opened}
      initialDate={
        opened?.date ??
        (dateParam && isValidDateString(dateParam) ? dateParam : defaultSleepDate(child.birthDate))
      }
      logs={logs.data}
      birthDate={child.birthDate}
      onDone={goBack}
    />
  )
}

/**
 * 수면일에 따라 어떤 기록을 입력하는지 정한다 (FR-SLEEP-08).
 * - 고른 수면일에 기록이 있으면 그 기록을 불러와 수정한다
 * - 없으면 수정하려고 연 기록은 그 수면일로 옮기고, 새 기록이면 그 수면일의 새 기록이다
 * 입력할 기록이 바뀌면 폼을 새로 그려(key) 그 기록의 값으로 채운다. 같은 기록이면 입력값을 그대로 둔다
 */
function SleepEditor({
  opened,
  initialDate,
  logs,
  birthDate,
  onDone,
}: {
  /** 수정하려고 연 기록 (/sleep/:id) */
  opened: SleepLog | undefined
  initialDate: string
  logs: SleepLog[]
  birthDate: string
  onDone: () => void
}) {
  const [date, setDate] = useState(initialDate)
  const atDate = logs.find((log) => log.date === date)
  const target = atDate ?? opened

  const hint =
    atDate && atDate.id !== opened?.id
      ? '이 수면일에 기록이 있어 불러왔어요'
      : opened && date !== opened.date
        ? '저장하면 이 기록의 수면일을 옮겨요'
        : target
          ? '밤잠에 든 날이에요'
          : '밤잠에 든 날이에요. 기본값은 어제예요'

  return (
    <FormPage title={target ? TITLE.edit : TITLE.new} onBack={onDone}>
      <SleepForm
        key={target?.id ?? 'new'}
        initial={target}
        date={date}
        onDateChange={setDate}
        dateHint={hint}
        birthDate={birthDate}
        onDone={onDone}
      />
    </FormPage>
  )
}
