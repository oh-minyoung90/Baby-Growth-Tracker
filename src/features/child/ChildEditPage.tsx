import { ChevronLeft } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Page } from '@/components/Page'
import { ChildForm } from './ChildForm'
import { useChild } from '@/lib/useChild'

/** 설정 > 아이 정보 수정 (FR-CHILD-03) */
export function ChildEditPage() {
  const navigate = useNavigate()
  const { data: child } = useChild()

  return (
    <Page title="아이 정보">
      <Link
        to="/settings"
        className="-mt-3 flex min-h-11 w-fit items-center gap-1 text-sm font-bold text-soft-text md:order-first"
      >
        <ChevronLeft className="size-4.5" aria-hidden />
        설정으로
      </Link>
      {child && (
        <ChildForm
          mode="edit"
          initial={child}
          onSaved={() => {
            toast.success('저장했어요')
            navigate('/settings')
          }}
        />
      )}
    </Page>
  )
}
