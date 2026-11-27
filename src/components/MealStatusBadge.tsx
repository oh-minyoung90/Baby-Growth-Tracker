import { ChevronDown } from 'lucide-react'
import { mealStatusLabel, type MealStatus } from '@/lib/mealTypes'
import { Badge } from './ui/badge'

const variants = {
  planned: 'plan',
  good: 'tried',
  eaten: 'tried',
  refused: 'outline',
} as const

export function MealStatusBadge({
  status,
  selectable = false,
}: {
  status: MealStatus
  selectable?: boolean
}) {
  return (
    <Badge variant={variants[status]} aria-hidden={selectable || undefined}>
      {mealStatusLabel(status)}
      {selectable && <ChevronDown />}
    </Badge>
  )
}
