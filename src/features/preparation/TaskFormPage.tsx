import { useState } from 'react'
import { useParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { DateField } from '@/components/form/DateField'
import { TextField } from '@/components/form/TextField'
import { DeleteRecordButton } from '@/components/DeleteRecordButton'
import { ErrorBanner } from '@/components/ErrorBanner'
import { FormActions, FormPage } from '@/components/FormPage'
import { ListLoading } from '@/components/ListLoading'
import { Button } from '@/components/ui/button'
import { NETWORK_ERROR_MESSAGES } from '@/lib/messages'
import { notifySaved, notifyDone } from '@/lib/notify'
import type { PreparationTask, TaskInput } from '@/lib/taskApi'
import { useGoBack } from '@/lib/useGoBack'
import { useDeleteTask, useSaveTask, useTask } from '@/lib/useTasks'
import { taskSchema, type TaskValues } from './taskSchema'

export function TaskFormPage() {
  const { id } = useParams()
  const query = useTask(id)
  const goBack = useGoBack('/preparation')
  return (
    <FormPage title={id ? '할 일 수정' : '할 일 추가'} onBack={goBack}>
      {id && query.isPending ? (
        <ListLoading />
      ) : id && query.isError ? (
        <ErrorBanner message={NETWORK_ERROR_MESSAGES.load} onRetry={() => void query.refetch()} />
      ) : id && !query.data ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          할 일을 찾을 수 없어요. 이미 삭제됐을 수 있어요
        </p>
      ) : (
        <TaskForm key={id ?? 'new'} initial={query.data ?? undefined} onDone={goBack} />
      )}
    </FormPage>
  )
}
function TaskForm({ initial, onDone }: { initial?: PreparationTask; onDone: () => void }) {
  const save = useSaveTask(),
    remove = useDeleteTask()
  const [failed, setFailed] = useState(false)
  const busy = save.isPending || remove.isPending
  const form = useForm<TaskValues, unknown, TaskInput>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      name: initial?.name ?? '',
      dueDate: initial?.dueDate ?? '',
      memo: initial?.memo ?? '',
      url: initial?.url ?? '',
    },
  })
  const submit = async (input: TaskInput) => {
    if (busy) return
    setFailed(false)
    try {
      await save.mutateAsync({ input, id: initial?.id })
      notifySaved()
      onDone()
    } catch {
      setFailed(true)
    }
  }
  const deleteItem = async () => {
    if (!initial || busy) return
    setFailed(false)
    try {
      await remove.mutateAsync(initial.id)
      notifyDone('삭제했어요')
      onDone()
    } catch {
      setFailed(true)
    }
  }
  return (
    <form onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-5" noValidate>
      {failed && <ErrorBanner />}
      <fieldset disabled={busy} className="flex min-w-0 flex-col gap-5">
        <TextField
          control={form.control}
          name="name"
          label="해야 할 일"
          maxLength={80}
          placeholder="예: 문화센터 등록"
        />
        <div className="flex flex-col gap-2">
          <DateField control={form.control} name="dueDate" label="마감일 (선택)" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() =>
              form.setValue('dueDate', '', { shouldDirty: true, shouldValidate: true })
            }
          >
            마감일 지우기
          </Button>
          <p className="text-[13px] text-muted-foreground">정해진 날짜가 있을 때만 선택해 주세요</p>
        </div>
        <TextField
          control={form.control}
          name="memo"
          label="메모 (선택)"
          maxLength={500}
          multiline
          placeholder="신청 일정이나 알아볼 내용을 적어 주세요"
        />
        <TextField
          control={form.control}
          name="url"
          label="관련 링크 (선택)"
          maxLength={2048}
          placeholder="https://"
        />
        {initial && (
          <DeleteRecordButton
            onConfirm={() => void deleteItem()}
            pending={busy}
            title="이 할 일을 삭제할까요?"
            description="삭제한 할 일은 되돌릴 수 없어요"
          />
        )}
        <FormActions>
          <Button type="button" variant="soft" onClick={onDone} disabled={busy}>
            취소
          </Button>
          <Button type="submit" disabled={busy}>
            {save.isPending ? '저장하는 중…' : initial ? '저장' : '추가하기'}
          </Button>
        </FormActions>
      </fieldset>
    </form>
  )
}
