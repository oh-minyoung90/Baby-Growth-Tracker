import { NavLink, Outlet, useMatches } from 'react-router'
import { Sprout } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from './navItems'

/** 라우트에 붙이는 표시 (routes.tsx의 handle) */
export interface AppRouteHandle {
  /** 모바일에서 아래쪽 탭 메뉴를 숨긴다: 화면 전환으로 여는 입력 화면 (components/FormPage) */
  hideBottomNav?: boolean
}

/**
 * 로그인 후 화면의 틀 (docs/디자인.md 5장)
 * - 768px 미만: 아래쪽 탭 메뉴 (입력 화면에서는 숨김)
 * - 768px 이상: 왼쪽 세로 메뉴 (폭 240px)
 */
export function AppLayout() {
  const hideBottomNav = useMatches().some(
    (match) => (match.handle as AppRouteHandle | undefined)?.hideBottomNav,
  )
  return (
    <div className="min-h-dvh md:flex">
      <SideNav />
      <main
        className={cn(
          'min-w-0 flex-1 md:pb-0',
          !hideBottomNav && 'pb-[calc(76px+env(safe-area-inset-bottom))]',
        )}
      >
        <Outlet />
      </main>
      {!hideBottomNav && <BottomNav />}
    </div>
  )
}

function SideNav() {
  return (
    <nav
      aria-label="주 메뉴"
      className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1.5 border-r bg-surface px-4 py-7 md:flex"
    >
      <div className="flex items-center gap-2.5 px-3 pb-6">
        <span className="flex size-9 items-center justify-center rounded-input bg-primary text-primary-foreground">
          <Sprout className="size-5" aria-hidden />
        </span>
        <strong className="text-base leading-tight">
          Baby Growth
          <br />
          Tracker
        </strong>
      </div>
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'flex h-12 items-center gap-3 rounded-button px-3.5 text-[15px] font-medium text-muted-foreground transition-colors hover:bg-muted',
              isActive && 'bg-soft font-bold text-primary hover:bg-soft',
            )
          }
        >
          <Icon className="size-5.5" aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

function BottomNav() {
  return (
    <nav
      aria-label="주 메뉴"
      className="fixed inset-x-0 bottom-0 z-40 grid h-[calc(76px+env(safe-area-inset-bottom))] grid-cols-5 border-t bg-surface px-1 pt-1.5 pb-[calc(10px+env(safe-area-inset-bottom))] md:hidden"
    >
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'group flex flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground',
              isActive && 'font-bold text-primary',
            )
          }
        >
          <span className="flex h-7.5 w-13 items-center justify-center rounded-full group-aria-[current=page]:bg-soft">
            <Icon className="size-5.5" aria-hidden />
          </span>
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
