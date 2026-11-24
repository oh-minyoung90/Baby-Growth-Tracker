import { Outlet } from 'react-router'
import { Page } from '@/components/Page'
import { SubTabs } from '@/components/SubTabs'
export function PreparationLayout() {
  return (
    <Page title="준비 목록">
      <SubTabs
        label="준비 목록 종류"
        items={[
          { to: '/preparation', label: '해야 할 일' },
          { to: '/shopping', label: '사야 할 물건' },
        ]}
      />
      <Outlet />
    </Page>
  )
}
