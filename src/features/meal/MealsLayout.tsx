import { Outlet, useLocation } from 'react-router'
import { Page } from '@/components/Page'
import { SubTabs } from '@/components/SubTabs'

// 식사 탭: 주간 식단 / 음식 목록 / 레시피 (기능요구사항서 6.1)
const TABS = [
  { to: '/meals/week', label: '주간 식단' },
  { to: '/meals/foods', label: '음식 목록' },
  { to: '/meals/recipes', label: '레시피' },
]

export function MealsLayout() {
  // 주간 식단만 본문 최대 폭 1,280px (docs/디자인.md 5장)
  const wide = useLocation().pathname.startsWith('/meals/week')
  return (
    <Page title="식사" wide={wide}>
      <SubTabs label="식사 화면" items={TABS} />
      <Outlet />
    </Page>
  )
}
