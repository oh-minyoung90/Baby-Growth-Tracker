import { Page } from '@/components/Page'
import { Placeholder } from '@/components/Placeholder'

export function HomePage() {
  return (
    <Page title="홈">
      <Placeholder task="T-28" description="오늘의 기록, 오늘의 식단, 빠른 기록" />
    </Page>
  )
}
