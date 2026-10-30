import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { ErrorBanner } from '@/components/ErrorBanner'
import { TextField } from '@/components/form/TextField'
import { Button } from '@/components/ui/button'
import { todayString } from '@/domain/date'
import { withObjectParticle } from '@/domain/josa'
import { CautionSaveError, type Food } from '@/lib/foodApi'
import { notifyDone } from '@/lib/notify'
import { useSetFoodCaution } from '@/lib/useFoods'
import { CautionInfoFields } from './CautionFields'
import { Notice } from './Notice'
import {
  MEMO_MAX,
  cautionSchema,
  serverCautionFieldError,
  type CautionFormOutput,
  type CautionFormValues,
} from './foodSchema'

/**
 * 알러지·주의 지정 (FR-FOOD-11, BR-11, R48). 음식 수정 시트에서 [알러지·주의로 지정]을 누르면 같은 시트가 이 화면으로 바뀐다.
 * 지정하면 음식이 알러지·주의로 옮겨지고 이력이 남는다. 보고 있던 탭은 그대로 둔다
 */
export function CautionForm({
  food,
  birthDate,
  onCancel,
  onDone,
}: {
  food: Food
  birthDate: string
  /** 수정 화면으로 돌아간다 */
  onCancel: () => void
  /** 지정 후 시트를 닫는다 */
  onDone: () => void
}) {
  const designate = useSetFoodCaution()
  const [failed, setFailed] = useState(false)
  const { control, handleSubmit, setError } = useForm<
    CautionFormValues,
    unknown,
    CautionFormOutput
  >({
    resolver: zodResolver(cautionSchema(birthDate)),
    defaultValues: {
      // "주의" 태그가 붙은 음식은 지금의 알러지·주의 정보를 이어서 쓴다
      reactionDate: food.reactionDate ?? todayString(),
      symptomNote: food.symptomNote ?? '',
      checkNote: food.checkNote ?? '',
      reason: '',
    },
  })

  const onSubmit = handleSubmit(async ({ reason, ...input }) => {
    setFailed(false)
    try {
      await designate.mutateAsync({ id: food.id, input, reason })
      notifyDone(`${withObjectParticle(food.name)} 알러지·주의로 지정했어요`)
      onDone()
    } catch (error) {
      // 서버(DB) 검증에 걸리면 화면 검증과 같은 자리에 같은 문구로 알린다 (FR-COM-13)
      const fieldError = serverCautionFieldError(
        error instanceof CautionSaveError ? error.reason : 'network',
      )
      if (fieldError) setError(fieldError.field, { message: fieldError.message })
      else setFailed(true)
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {failed && <ErrorBanner onRetry={() => void onSubmit()} retrying={designate.isPending} />}
      <Notice
        tone="caution"
        title={`${withObjectParticle(food.name)} 알러지·주의로 옮겨요`}
        detail="반응이 있었던 날짜를 넣고 지정해 주세요"
      />
      <CautionInfoFields control={control} birthDate={birthDate} />
      <TextField
        control={control}
        name="reason"
        id="caution-reason"
        label="지정 사유 (선택)"
        placeholder="예: 소아과에서 당분간 먹이지 말라고 했어요"
        maxLength={MEMO_MAX}
        multiline
      />
      <div className="mt-1 grid grid-cols-2 gap-2.5">
        <Button type="button" variant="soft" size="lg" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" size="lg" disabled={designate.isPending}>
          {designate.isPending ? '지정하는 중…' : '지정'}
        </Button>
      </div>
    </form>
  )
}
