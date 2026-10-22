import { Outlet } from 'react-router'
import { Page } from '@/components/Page'
import { SubTabs } from '@/components/SubTabs'

// 성장 탭: 키·몸무게 / 단어 / 수면 (기능요구사항서 2.2)
const TABS = [
  { to: '/growth/body', label: '키·몸무게' },
  { to: '/growth/words', label: '단어' },
  { to: '/growth/sleep', label: '수면' },
]

export function GrowthLayout() {
  return (
    <Page title="성장">
      <SubTabs label="성장 기록 종류" items={TABS} />
      <Outlet />
    </Page>
  )
}
