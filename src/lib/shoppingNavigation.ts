import { useSyncExternalStore } from 'react'
import { useAuth } from './auth'

const listeners = new Set<() => void>()
const fallback = new Map<string, boolean>()
export function shoppingNavKey(userId: string) {
  return `bgt-shopping-tab:${userId}`
}
function read(key: string) {
  if (fallback.has(key)) return fallback.get(key)!
  try {
    return localStorage.getItem(key) === 'true'
  } catch {
    return false
  }
}
function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key?.startsWith('bgt-shopping-tab:') || event.key === null) {
      if (event.key) fallback.delete(event.key)
      else fallback.clear()
      listener()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}
/** 계정별·브라우저별 메뉴 설정. 기본은 기존 설정 탭이며 저장소가 막혀도 현재 화면에는 적용한다. */
export function useShoppingNavigation() {
  const auth = useAuth()
  const id = auth.session?.user.id ?? ''
  const key = shoppingNavKey(id)
  const enabled = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => false,
  )
  const setEnabled = (value: boolean) => {
    if (!id) return
    fallback.set(key, value)
    try {
      localStorage.setItem(key, String(value))
      fallback.delete(key)
    } catch {
      /* 현재 세션의 선택은 유지한다. */
    }
    listeners.forEach((listener) => listener())
  }
  return [enabled, setEnabled] as const
}
