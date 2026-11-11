import { Outlet } from 'react-router'
import { Page } from '@/components/Page'
import { SubTabs } from '@/components/SubTabs'

// 식사 탭: 주간 식단 / 음식 목록 / 레시피 (기능요구사항서 6.1)
const TABS = [
  { to: '/meals/week', label: '주간 식단' },
  { to: '/meals/foods', label: '음식 목록' },
  { to: '/meals/recipes', label: '레시피' },
]

export function MealsLayout() {
  // 식사 안의 세 탭은 같은 폭과 시작 위치를 쓴다 (docs/디자인.md 5장).
  return (
    <Page title="식사" wide>
      <SubTabs label="식사 화면" items={TABS} />
      <Outlet />
    </Page>
  )
}
