import { addDays, format, startOfWeek } from 'date-fns'
import { isValidDateString, parseDate, todayString } from './date'

/** 기기 시간대로 월~일을 계산한다. UTC 변환 없이 날짜만 다룬다 (FR-MEAL-01). */
export function mealWeek(date: string) {
  const monday = startOfWeek(parseDate(date), { weekStartsOn: 1 })
  const days = Array.from({ length: 7 }, (_, index) => todayString(addDays(monday, index)))
  const sunday = parseDate(days[6])
  const sameMonth = monday.getMonth() === sunday.getMonth()
  const sameYear = monday.getFullYear() === sunday.getFullYear()
  const label =
    sameMonth && sameYear
      ? `${format(monday, 'yyyy년 M월 d일')} ~ ${format(sunday, 'd일')}`
      : `${format(monday, 'yyyy년 M월 d일')} ~ ${format(sunday, sameYear ? 'M월 d일' : 'yyyy년 M월 d일')}`
  return { start: days[0], end: days[6], days, label }
}

export function weekFromParam(value: string | null, today: string) {
  return mealWeek(value && isValidDateString(value) ? value : today)
}

export function shiftMealWeek(start: string, direction: -1 | 1) {
  return todayString(addDays(parseDate(start), direction * 7))
}
