import { NavLink } from 'react-router'
import { cn } from '@/lib/utils'

/** 화면 안의 상단 탭 (성장: 키·몸무게/단어/수면, 식사: 주간 식단/음식 목록/레시피) */
export function SubTabs({
  label,
  items,
}: {
  label: string
  items: { to: string; label: string }[]
}) {
  return (
    <nav
      aria-label={label}
      className="grid rounded-button bg-soft p-1 md:inline-flex md:self-start"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            cn(
              'flex h-10 items-center justify-center rounded-md px-4.5 text-sm font-medium text-soft-text',
              isActive && 'bg-surface font-bold text-primary',
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
