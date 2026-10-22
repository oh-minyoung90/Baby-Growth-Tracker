import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyTheme, getThemeMode, resolveTheme, setThemeMode, THEME_STORAGE_KEY } from './theme'

function mockSystemDark(dark: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation(() => ({
      matches: dark,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
}

beforeEach(() => {
  window.localStorage.clear()
  document.documentElement.classList.remove('dark')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('resolveTheme', () => {
  it('기기 설정을 따르면 기기 값으로 정해진다', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('직접 고르면 기기 설정과 상관없다', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
})

describe('화면 모드 저장과 적용 (FR-SET-10)', () => {
  it('기본값은 기기 설정', () => {
    expect(getThemeMode()).toBe('system')
  })

  it('다크를 고르면 저장되고 <html>에 dark 클래스가 붙는다', () => {
    mockSystemDark(false)
    setThemeMode('dark')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('기기 설정으로 돌리면 저장값을 지우고 기기 값을 따른다', () => {
    mockSystemDark(false)
    setThemeMode('dark')
    setThemeMode('system')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('기기가 다크면 기기 설정 모드에서 dark 클래스가 붙는다', () => {
    mockSystemDark(true)
    applyTheme()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('저장값이 잘못되었으면 기기 설정으로 본다', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'purple')
    expect(getThemeMode()).toBe('system')
  })
})
