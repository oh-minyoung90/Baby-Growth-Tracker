/** 키·몸무게 표시 형식 (목록·차트 공통) */

/** 72.1 → '72.1cm', 9 → '9.0kg'. 값이 없으면 '-' (FR-BODY-05) */
export function formatMeasureValue(value: number | null, unit: string): string {
  return value === null ? '-' : `${value.toFixed(1)}${unit}`
}
