import { Clock, House, Settings, Sprout, Utensils, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** 홈('/')은 하위 경로에서 선택 표시를 하지 않는다 */
  end?: boolean
}

// 주 메뉴 5개 (기능요구사항서 2.2, docs/디자인.md 5장)
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: '홈', icon: House, end: true },
  { to: '/growth', label: '성장', icon: Sprout },
  { to: '/timeline', label: '타임라인', icon: Clock },
  { to: '/meals', label: '식사', icon: Utensils },
  { to: '/settings', label: '설정', icon: Settings },
]
