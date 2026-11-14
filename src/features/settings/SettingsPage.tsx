import { useState } from 'react'
import { Page } from '@/components/Page'
import { DeleteAllSection } from './DeleteAllSection'
import { BackupSection } from './BackupSection'
import { AccountSection } from './AccountSection'
import { ChildSection } from './ChildSection'
import { ThemeModeSelector } from './ThemeModeSelector'

export function SettingsPage() {
  const [busy, setBusy] = useState(false)
  return (
    <Page title="설정">
      <fieldset disabled={busy} className="contents">
        <ChildSection />
        <section aria-labelledby="settings-theme" className="flex flex-col gap-2">
          <h2 id="settings-theme" className="text-[13px] font-bold text-muted-foreground">
            화면 모드
          </h2>
          <ThemeModeSelector />
        </section>
        <BackupSection onBusyChange={setBusy} />
        <DeleteAllSection onBusyChange={setBusy} />
        <AccountSection />
      </fieldset>
    </Page>
  )
}
