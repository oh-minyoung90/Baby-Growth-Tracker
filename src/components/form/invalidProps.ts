/** 입력칸에 붙이는 접근성 속성: 오류가 있으면 오류 상태로 표시하고 오류 문구(`${id}-error`)와 연결한다 */
export function invalidProps(id: string, error: string | undefined) {
  return error ? { 'aria-invalid': true, 'aria-describedby': `${id}-error` } : {}
}
