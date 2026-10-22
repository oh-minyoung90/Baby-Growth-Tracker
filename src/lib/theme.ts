import { useSyncExternalStore } from 'react'

/**
 * 화면 모드 (FR-SET-10, docs/디자인.md 1.2)
 * - 'system': 기기 설정을 따른다 (기본값)
 * - 'light' / 'dark': 사용자가 직접 고른 모드
 * 선택은 이 브라우저의 localStorage에만 저장한다. 저장소를 쓸 수 없으면(사생활 보호 모드 등) 기본값으로 동작한다.
 */
export type ThemeMode = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'bgt-theme-mode'
const DARK_QUERY = '(prefers-color-scheme: dark)'

const listeners = new Set<() => void>()

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark'
}

export function getThemeMode(): ThemeMode {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isThemeMode(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

function systemPrefersDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches
}

export function resolveTheme(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
  if (mode === 'system') return prefersDark ? 'dark' : 'light'
  return mode
}

export function getResolvedTheme(): ResolvedTheme {
  return resolveTheme(getThemeMode(), systemPrefersDark())
}

/** <html>에 dark 클래스를 붙이거나 뗀다 */
export function applyTheme(): void {
  document.documentElement.classList.toggle('dark', getResolvedTheme() === 'dark')
}

export function setThemeMode(mode: ThemeMode): void {
  try {
    if (mode === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY)
    else window.localStorage.setItem(THEME_STORAGE_KEY, mode)
  } catch {
    // 저장하지 못해도 이번 화면에는 적용한다
  }
  applyTheme()
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  const media = typeof window.matchMedia === 'function' ? window.matchMedia(DARK_QUERY) : null
  const onSystemChange = () => {
    applyTheme()
    listener()
  }
  media?.addEventListener('change', onSystemChange)
  return () => {
    listeners.delete(listener)
    media?.removeEventListener('change', onSystemChange)
  }
}

/** 사용자가 고른 모드 (설정 화면용) */
export function useThemeMode(): ThemeMode {
  return useSyncExternalStore(subscribe, getThemeMode, () => 'system')
}

/** 실제로 적용된 모드 (라이트/다크) */
export function useResolvedTheme(): ResolvedTheme {
  return useSyncExternalStore(subscribe, getResolvedTheme, () => 'light')
}
