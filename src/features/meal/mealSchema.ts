import { z } from 'zod'
import { isValidDateString, todayString } from '@/domain/date'
import { MEAL_INTAKES } from '@/lib/mealTypes'
import { optionalText, recordDate, requiredText } from '@/lib/validation'

export const MEAL_MESSAGES = {
  selection: '음식이나 레시피를 하나 이상 선택해 주세요',
  futureEaten: '내일 이후 식단은 먹음으로 기록할 수 없어요',
  duplicate: '그 끼니에는 이미 식단이 있어요. 창을 닫고 해당 기록을 다시 열어 주세요',
  staleItem: '음식 목록이 바뀌었어요. 선택한 음식을 빼고 다시 골라 주세요',
  notFound: '식단을 찾을 수 없어요. 창을 닫고 목록을 다시 확인해 주세요',
} as const

export function mealSchema(birthDate?: string) {
  return z
    .object({
      date: recordDate({ birthDate, allowFuture: true }),
      foods: z.array(
        z.object({
          id: z.string().nullable(),
          name: requiredText(20, '음식 이름을 확인해 주세요'),
        }),
      ),
      recipes: z.array(
        z.object({
          id: z.string().nullable(),
          name: requiredText(30, '레시피 이름을 확인해 주세요'),
        }),
      ),
      eaten: z.boolean(),
      intake: z
        .enum(['', ...MEAL_INTAKES.map((item) => item.value)])
        .transform((value) => value || null),
      memo: optionalText(500),
    })
    .refine((value) => value.foods.length + value.recipes.length > 0, {
      path: ['foods'],
      message: MEAL_MESSAGES.selection,
    })
    .refine(
      (value) => !value.eaten || !isValidDateString(value.date) || value.date <= todayString(),
      { path: ['eaten'], message: MEAL_MESSAGES.futureEaten },
    )
}
export type MealFormValues = z.input<ReturnType<typeof mealSchema>>
export type MealFormOutput = z.output<ReturnType<typeof mealSchema>>
