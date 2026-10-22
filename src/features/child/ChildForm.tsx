import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { CircleAlert, Sprout } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { calculateAge, formatAge } from '@/domain/age'
import { parseDate, todayString } from '@/domain/date'
import { withTopicParticle } from '@/domain/josa'
import { cn } from '@/lib/utils'
import { ChildSaveError, type Child, type ChildInput } from '@/lib/childApi'
import { useSaveChild } from '@/lib/useChild'

/** 아이 정보 입력 폼: 첫 등록(SCR-02)과 설정에서 수정할 때 함께 쓴다 (FR-CHILD-02~03) */

const NAME_MAX = 20

function isValidDate(value: string) {
  try {
    parseDate(value)
    return true
  } catch {
    return false
  }
}

const schema = z.object({
  nickname: z
    .string()
    .trim()
    .min(1, '이름 또는 별명을 입력해 주세요')
    .max(NAME_MAX, `${NAME_MAX}자까지 입력할 수 있어요`),
  birthDate: z
    .string()
    .min(1, '생년월일을 입력해 주세요')
    .refine(isValidDate, '날짜를 다시 확인해 주세요')
    .refine((v) => v <= todayString(), '오늘 이후 날짜는 고를 수 없어요'),
})

type FormValues = z.input<typeof schema>

const SAVE_ERROR: Record<ChildSaveError['reason'], string> = {
  futureDate: '오늘 이후 날짜는 고를 수 없어요',
  invalid: '이름은 1~20자로 입력해 주세요',
  network: '저장하지 못했어요. 인터넷 연결을 확인해 주세요',
}

/** 오늘 기준 생후 일수 미리보기 문구. 날짜가 올바르지 않으면 null */
function agePreview(nickname: string, birthDate: string): string | null {
  const today = todayString()
  if (!isValidDate(birthDate) || birthDate > today) return null
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
  const save = useSaveChild()
  const [confirmInput, setConfirmInput] = useState<ChildInput | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const today = todayString()

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { nickname: initial?.nickname ?? '', birthDate: initial?.birthDate ?? '' },
  })
  const [nickname, birthDate] = useWatch({ control, name: ['nickname', 'birthDate'] })
  const preview = agePreview(nickname, birthDate)

  const submit = async (input: ChildInput) => {
    setSaveError(null)
    try {
      onSaved(await save.mutateAsync(input))
    } catch (error) {
      setSaveError(SAVE_ERROR[error instanceof ChildSaveError ? error.reason : 'network'])
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
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="child-nickname">이름 또는 별명</Label>
          <span className="text-[13px] text-muted-foreground" aria-hidden>
            {nickname.length} / {NAME_MAX}
          </span>
        </div>
        <Input
          id="child-nickname"
          placeholder="예: 하늘이"
          maxLength={NAME_MAX}
          autoComplete="off"
          aria-invalid={errors.nickname ? true : undefined}
          aria-describedby={errors.nickname ? 'child-nickname-error' : undefined}
          {...register('nickname')}
        />
        {errors.nickname?.message && (
          <FieldError id="child-nickname-error">{errors.nickname.message}</FieldError>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="child-birth">생년월일</Label>
        <Input
          id="child-birth"
          type="date"
          max={today}
          aria-invalid={errors.birthDate ? true : undefined}
          aria-describedby={errors.birthDate ? 'child-birth-error' : undefined}
          {...register('birthDate')}
        />
        {errors.birthDate?.message && (
          <FieldError id="child-birth-error">{errors.birthDate.message}</FieldError>
        )}
      </div>

      {preview && (
        <p
          aria-live="polite"
          className="flex items-center gap-3 rounded-2xl bg-soft p-4 text-[15px] text-soft-text"
        >
          <Sprout className="size-5.5 shrink-0" aria-hidden />
          {preview}
        </p>
      )}

      {saveError && <FieldError id="child-save-error">{saveError}</FieldError>}

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

      <AlertDialog
        open={confirmInput !== null}
        onOpenChange={(open) => !open && setConfirmInput(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>생년월일을 바꿀까요?</AlertDialogTitle>
            <AlertDialogDescription>모든 기록의 생후 일수 표시가 바뀌어요</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmInput) void submit(confirmInput)
              }}
            >
              바꾸기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  )
}

function FieldError({ id, children }: { id: string; children: string }) {
  return (
    <p id={id} role="alert" className="flex items-center gap-1.5 text-sm text-danger">
      <CircleAlert className="size-4 shrink-0" aria-hidden />
      {children}
    </p>
  )
}
