import {
  House,
  Moon,
  Settings,
  ClipboardCheck,
  Sprout,
  Utensils,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** 홈('/')은 하위 경로에서 선택 표시를 하지 않는다 */
  end?: boolean
}

// 주 메뉴 5개 (기능요구사항서 2.2, R1, docs/디자인.md 5장)
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: '홈', icon: House, end: true },
  { to: '/meals', label: '식사', icon: Utensils },
  { to: '/growth', label: '성장', icon: Sprout },
  { to: '/sleep', label: '수면', icon: Moon },
  { to: '/settings', label: '설정', icon: Settings },
]

export const SHOPPING_NAV_ITEM: NavItem = {
  to: '/preparation',
  label: '준비',
  icon: ClipboardCheck,
}
