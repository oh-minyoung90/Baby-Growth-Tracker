import { addMonths, differenceInCalendarDays } from 'date-fns'
import { parseDate } from './date'

export interface Age {
  months: number
  days: number
}

/**
 * 생년월일과 기록 날짜로 생후 개월·일을 계산한다 (BR-01, 기능요구사항서 3.2).
 *
 * 생년월일에 개월을 더해 가며 기록 날짜를 넘지 않는 가장 큰 개월 수를 찾고, 남은 날수를 일로 센다.
 * 다음 달에 생일과 같은 날짜가 없으면 그 달 말일을 기준일로 본다 (date-fns addMonths의 동작과 같다).
 * 예: 1월 31일생은 2월 28일에 1개월 0일, 3월 1일에 1개월 1일.
 *
 * @param birthDate 생년월일 'YYYY-MM-DD'
 * @param recordDate 기록 날짜 'YYYY-MM-DD'
 * @throws RangeError 날짜 형식이 틀리거나 기록 날짜가 생년월일보다 이를 때
 */
export function calculateAge(birthDate: string, recordDate: string): Age {
  const birth = parseDate(birthDate)
  const record = parseDate(recordDate)
  if (record < birth) {
    throw new RangeError(`기록 날짜(${recordDate})가 생년월일(${birthDate})보다 이릅니다`)
  }

  let months =
    (record.getFullYear() - birth.getFullYear()) * 12 + (record.getMonth() - birth.getMonth())
  if (addMonths(birth, months) > record) {
    months -= 1
  }
  const days = differenceInCalendarDays(record, addMonths(birth, months))
  return { months, days }
}

/** "생후 N개월 N일", 0개월이면 "생후 N일" (기능요구사항서 3.2) */
export function formatAge({ months, days }: Age): string {
  return months === 0 ? `생후 ${days}일` : `생후 ${months}개월 ${days}일`
}

/** 기록 날짜의 생후 일수 문구. 생년월일을 나중에 바꿔 기록 날짜가 더 이르면 표시하지 않는다(null) */
export function ageLabel(birthDate: string | undefined, date: string): string | null {
  if (!birthDate || date < birthDate) return null
  return formatAge(calculateAge(birthDate, date))
}
