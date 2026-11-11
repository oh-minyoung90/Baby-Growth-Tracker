import { TriangleAlert } from 'lucide-react'
import { mealCautionMessage } from '@/lib/mealCaution'
import type { Food } from '@/lib/foodApi'

export function MealCautionNotice({ foods }: { foods: readonly Pick<Food, 'name'>[] }) {
  if (foods.length === 0) return null
  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-button bg-danger-soft p-3 text-sm text-danger-text"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{mealCautionMessage(foods)}</span>
    </p>
  )
}
