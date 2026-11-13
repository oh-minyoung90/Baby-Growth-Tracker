import { z } from 'zod'
import { optionalText, requiredText } from '@/lib/validation'
export const recipeSchema = z.object({
  name: requiredText(30, '레시피 이름을 입력해 주세요'),
  servings: optionalText(20),
  ingredients: z
    .array(
      z.object({
        foodId: z.string().nullable(),
        name: requiredText(20, '재료 이름을 입력해 주세요'),
        amount: optionalText(20),
      }),
    )
    .min(1, '재료를 하나 이상 입력해 주세요'),
  steps: z
    .array(z.object({ text: z.string().trim().min(1, '조리 순서를 입력해 주세요') }))
    .min(1, '조리 순서를 하나 이상 입력해 주세요'),
  note: optionalText(500),
})
export type RecipeFormValues = z.input<typeof recipeSchema>
export type RecipeFormOutput = z.output<typeof recipeSchema>
