import { Outlet } from 'react-router'
import { Page } from '@/components/Page'
import { SubTabs } from '@/components/SubTabs'

// 성장 탭: 기록(발달 타임라인) / 키·몸무게 (기능요구사항서 2.2, R1)
const TABS = [
  { to: '/growth/timeline', label: '기록' },
  { to: '/growth/body', label: '키·몸무게' },
]

export function GrowthLayout() {
  return (
    <Page title="성장">
      <SubTabs label="성장 기록 종류" items={TABS} />
      <Outlet />
    </Page>
  )
}
