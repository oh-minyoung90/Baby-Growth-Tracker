import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// 테스트마다 렌더링한 화면을 정리해 다음 테스트에 영향을 주지 않게 한다
afterEach(() => {
  cleanup()
})
