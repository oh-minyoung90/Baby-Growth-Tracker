import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { toast } from 'sonner'
import { afterEach } from 'vitest'

// 테스트마다 렌더링한 화면을 정리해 다음 테스트에 영향을 주지 않게 한다
afterEach(() => {
  cleanup()
  // 알림(toast)은 전역에 남아 다음 테스트 화면에 다시 나타나므로 함께 지운다
  toast.dismiss()
})
