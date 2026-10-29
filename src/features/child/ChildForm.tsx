import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Sprout } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ErrorBanner } from '@/components/ErrorBanner'
import { DateField } from '@/components/form/DateField'
import { TextField } from '@/components/form/TextField'
import { Button } from '@/components/ui/button'
import { calculateAge, formatAge } from '@/domain/age'
import { isValidDateString, todayString } from '@/domain/date'
import { withTopicParticle } from '@/domain/josa'
import { ChildSaveError, type Child, type ChildInput } from '@/lib/childApi'
import { useSaveChild } from '@/lib/useChild'
import { cn } from '@/lib/utils'
import { DATE_MESSAGES, recordDate, requiredText } from '@/lib/validation'

/** 아이 정보 입력 폼: 첫 등록(SCR-02)과 설정에서 수정할 때 함께 쓴다 (FR-CHILD-02~03) */

const NAME_MAX = 20

const schema = z.object({
  nickname: requiredText(NAME_MAX, '이름 또는 별명을 입력해 주세요'),
  birthDate: recordDate(),
})

type FormValues = z.input<typeof schema>

/** 오늘 기준 생후 일수 미리보기 문구. 날짜가 올바르지 않으면 null */
function agePreview(nickname: string, birthDate: string): string | null {
  const today = todayString()
  if (!isValidDateString(birthDate) || birthDate > today) return null
  const name = nickname.trim() || '우리 아이'
  return `${withTopicParticle(name)} 오늘 ${formatAge(calculateAge(birthDate, today))}이에요`
}

export function ChildForm({
  mode,
  initial,
  onSaved,
}: {
  mode: 'create' | 'edit'
  initial?: Child
  onSaved: (child: Child) => void
}) {
  // 첫 등록이면 기본 음식 목록도 함께 추가한다 (FR-FOOD-07)
  const save = useSaveChild({ withDefaultFoods: mode === 'create' })
  const [confirmInput, setConfirmInput] = useState<ChildInput | null>(null)
  const [networkError, setNetworkError] = useState(false)

  const { control, handleSubmit, setError } = useForm<FormValues, unknown, z.output<typeof schema>>(
    {
      resolver: zodResolver(schema),
      defaultValues: { nickname: initial?.nickname ?? '', birthDate: initial?.birthDate ?? '' },
    },
  )
  const [nickname, birthDate] = useWatch({ control, name: ['nickname', 'birthDate'] })
  const preview = agePreview(nickname, birthDate)

  const submit = async (input: ChildInput) => {
    setNetworkError(false)
    try {
      onSaved(await save.mutateAsync(input))
    } catch (error) {
      // 서버(DB) 검증에 걸리면 화면 검증과 같은 자리에 같은 문구로 알린다 (FR-COM-13)
      const reason = error instanceof ChildSaveError ? error.reason : 'network'
      if (reason === 'futureDate') setError('birthDate', { message: DATE_MESSAGES.future })
      else if (reason === 'invalid')
        setError('nickname', { message: '이름은 1~20자로 입력해 주세요' })
      else setNetworkError(true)
    }
  }

  const onSubmit = handleSubmit((values) => {
    // 생년월일을 바꾸면 모든 기록의 생후 일수가 바뀌므로 한 번 더 확인한다 (FR-CHILD-03)
    if (mode === 'edit' && initial && values.birthDate !== initial.birthDate) {
      setConfirmInput(values)
      return
    }
    void submit(values)
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-1 flex-col gap-5">
      {/* 네트워크 오류: 입력값은 그대로 두고 다시 시도할 수 있게 한다 (기능요구사항서 3.4) */}
      {networkError && <ErrorBanner onRetry={() => void onSubmit()} retrying={save.isPending} />}

      <TextField
        control={control}
        name="nickname"
        id="child-nickname"
        label="이름 또는 별명"
        placeholder="예: 하늘이"
        maxLength={NAME_MAX}
      />
      <DateField
        control={control}
        name="birthDate"
        id="child-birth"
        label="생년월일"
        max={todayString()}
      />

      {preview && (
        <p
          aria-live="polite"
          className="flex items-center gap-3 rounded-2xl bg-soft p-4 text-[15px] text-soft-text"
        >
          <Sprout className="size-5.5 shrink-0" aria-hidden />
          {preview}
        </p>
      )}

      <div className={cn('flex flex-col gap-2.5', mode === 'create' && 'mt-auto pt-4')}>
        <Button type="submit" size="lg" disabled={save.isPending}>
          {save.isPending ? '저장하는 중…' : mode === 'create' ? '시작하기' : '저장'}
        </Button>
        {mode === 'create' && (
          <p className="text-center text-[13px] text-muted-foreground">
            나중에 설정에서 바꿀 수 있어요
          </p>
        )}
      </div>

      <ConfirmDialog
        open={confirmInput !== null}
        onOpenChange={(open) => !open && setConfirmInput(null)}
        title="생년월일을 바꿀까요?"
        description="모든 기록의 생후 일수 표시가 바뀌어요"
        confirmLabel="바꾸기"
        onConfirm={() => {
          if (confirmInput) void submit(confirmInput)
        }}
      />
    </form>
  )
}
