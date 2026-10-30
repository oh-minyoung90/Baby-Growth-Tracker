import type { Control, FieldPath, FieldValues } from 'react-hook-form'
import { DateField } from '@/components/form/DateField'
import { TextField } from '@/components/form/TextField'
import { todayString } from '@/domain/date'
import { MEMO_MAX } from './foodSchema'

/** 알러지·주의 정보 입력칸을 가진 폼 (지정 화면, 알러지·주의 음식 수정 화면) */
type CautionFieldValues = FieldValues & {
  reactionDate: string
  symptomNote: string
  checkNote: string
}

/** 알러지·주의 정보 입력칸 (FR-FOOD-11): 반응 날짜(필수, 오늘까지), 증상 메모, 확인 메모 */
export function CautionInfoFields<T extends CautionFieldValues, TOut>({
  control,
  birthDate,
}: {
  control: Control<T, unknown, TOut>
  birthDate: string
}) {
  // 두 폼이 같은 이름의 입력칸을 쓴다
  const name = (key: 'reactionDate' | 'symptomNote' | 'checkNote') => key as FieldPath<T>

  return (
    <>
      <DateField
        control={control}
        name={name('reactionDate')}
        id="caution-reaction-date"
        label="반응 날짜"
        min={birthDate}
        max={todayString()}
      />
      <TextField
        control={control}
        name={name('symptomNote')}
        id="caution-symptom"
        label="증상 메모"
        placeholder="예: 먹고 30분 뒤 입 주변이 빨개졌어요"
        maxLength={MEMO_MAX}
        multiline
      />
      <TextField
        control={control}
        name={name('checkNote')}
        id="caution-check"
        label="확인 메모"
        placeholder="예: 소아과 진료를 받았어요"
        maxLength={MEMO_MAX}
        multiline
      />
    </>
  )
}
