import { z } from 'zod'
import { optionalText, requiredText } from '@/lib/validation'
import { parseRecipeIngredients, parseRecipeSteps } from './recipeText'
export const recipeSchema = z.object({
  name: requiredText(30, '레시피 이름을 입력해 주세요'),
  servings: optionalText(20),
  ingredientsText: z
    .string()
    .transform(parseRecipeIngredients)
    .superRefine((items, ctx) => {
      if (!items.length) ctx.addIssue({ code: 'custom', message: '재료를 하나 이상 입력해 주세요' })
      items.forEach((item, index) => {
        const message = !item.name
          ? '재료 이름을 입력해 주세요'
          : item.name.length > 20
            ? '재료 이름은 20자까지 입력할 수 있어요. 이름과 양은 |로 구분할 수 있어요'
            : (item.amount?.length ?? 0) > 20
              ? '양은 20자까지 입력할 수 있어요'
              : null
        if (message) ctx.addIssue({ code: 'custom', message: `${index + 1}번: ${message}` })
      })
    }),
  stepsText: z
    .string()
    .transform(parseRecipeSteps)
    .refine((steps) => steps.length > 0, '조리 순서를 하나 이상 입력해 주세요'),
  note: optionalText(500),
})
export type RecipeFormValues = z.input<typeof recipeSchema>
export type RecipeFormOutput = z.output<typeof recipeSchema>
