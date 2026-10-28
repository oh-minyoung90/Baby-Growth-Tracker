import { Page } from '@/components/Page'
import { Placeholder } from '@/components/Placeholder'

/** 수면 (SCR-08): 주 메뉴의 수면 탭 (R1) */
export function SleepPage() {
  return (
    <Page title="수면">
      <Placeholder task="T-26, T-27" description="수면 기록" />
    </Page>
  )
}
