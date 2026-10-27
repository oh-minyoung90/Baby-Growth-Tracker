import { calculateAge, formatAge } from '@/domain/age'

/** 키·몸무게 표시 형식 (목록·차트 공통) */

/** 72.1 → '72.1cm', 9 → '9.0kg'. 값이 없으면 '-' (FR-BODY-05) */
export function formatMeasureValue(value: number | null, unit: string): string {
  return value === null ? '-' : `${value.toFixed(1)}${unit}`
}

/** 생후 일수. 생년월일을 나중에 바꿔 기록 날짜가 더 이르면 표시하지 않는다 */
export function ageLabel(birthDate: string | undefined, date: string): string | null {
  if (!birthDate || date < birthDate) return null
  return formatAge(calculateAge(birthDate, date))
}
