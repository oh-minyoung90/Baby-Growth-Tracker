import { ChevronLeft } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router'
import { MobileSettingsLink } from '@/components/MobileSettingsLink'
import { Page } from '@/components/Page'
import { notifySaved } from '@/lib/notify'
import { ChildForm } from './ChildForm'
import { useChild } from '@/lib/useChild'

/** 설정 > 아이 정보 수정 (FR-CHILD-03) */
export function ChildEditPage() {
  const navigate = useNavigate()
  const fromHome = useLocation().state?.fromHome === true
  const returnTo = fromHome ? '/' : '/settings'
  const { data: child } = useChild()

  return (
    <Page
      title="아이 정보"
      toolbar={
        <div className="mb-3 flex h-[52px] items-center justify-between md:mb-4 md:h-11">
          <Link
            to="/"
            className="flex min-h-11 items-center gap-1 rounded-input text-sm font-bold text-soft-text outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            <ChevronLeft className="size-4.5" aria-hidden />
            홈으로
          </Link>
          <MobileSettingsLink />
        </div>
      }
    >
      {child && (
        <ChildForm
          mode="edit"
          initial={child}
          onSaved={() => {
            notifySaved()
            navigate(returnTo, { replace: true })
          }}
        />
      )}
    </Page>
  )
}
