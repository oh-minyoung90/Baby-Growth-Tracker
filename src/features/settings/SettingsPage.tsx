import { Page } from '@/components/Page'
import { Placeholder } from '@/components/Placeholder'
import { AccountSection } from './AccountSection'
import { ChildSection } from './ChildSection'
import { ThemeModeSelector } from './ThemeModeSelector'

export function SettingsPage() {
  return (
    <Page title="설정">
      <ChildSection />
      <section aria-labelledby="settings-theme" className="flex flex-col gap-2">
        <h2 id="settings-theme" className="text-[13px] font-bold text-muted-foreground">
          화면 모드
        </h2>
        <ThemeModeSelector />
      </section>
      <Placeholder task="T-29~T-31" description="데이터 내보내기·가져오기·전체 삭제" />
      <AccountSection />
    </Page>
  )
}
