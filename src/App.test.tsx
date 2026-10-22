import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('앱 제목과 공통 컴포넌트를 표시한다', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Baby Growth Tracker' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: '화면 모드' })).toBeInTheDocument()
  })
})
