import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { buttonVariants } from '@/components/ui/button'
import { usePageTitle } from '@/lib/usePageTitle'

/** 없는 주소이거나 화면을 그리다 오류가 났을 때 */
export function RouteError({ notFound: forceNotFound = false }: { notFound?: boolean }) {
  const error = useRouteError()
  const notFound = forceNotFound || (isRouteErrorResponse(error) && error.status === 404)
  usePageTitle(notFound ? '페이지 없음' : '오류')
  return (
    <main className="mx-auto flex min-h-dvh max-w-100 flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-xl font-bold">
        {notFound ? '페이지를 찾을 수 없어요' : '문제가 생겼어요'}
      </h1>
      <p className="text-[15px] text-muted-foreground">
        {notFound ? '주소를 다시 확인해 주세요' : '잠시 후 다시 시도해 주세요'}
      </p>
      <Link to="/" className={buttonVariants({ className: 'mt-2' })}>
        홈으로
      </Link>
    </main>
  )
}
