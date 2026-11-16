import type { RootOptions } from 'react-dom/client'

/** 원본 오류·stack·기록 내용·사진 URL을 전달받아도 콘솔에 내보내지 않는다. */
export function reportUnexpectedError(): void {
  console.error('화면 처리 중 오류가 발생했어요. 새로고침 후 다시 시도해 주세요.')
}

// React 기본 오류 출력도 error/cause/componentStack에 민감한 내용이 섞일 수 있다.
export const safeRootErrors: RootOptions = {
  onCaughtError: reportUnexpectedError,
  onUncaughtError: reportUnexpectedError,
  onRecoverableError: reportUnexpectedError,
}
