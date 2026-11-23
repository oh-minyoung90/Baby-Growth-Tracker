import { z } from 'zod'
import { SHOPPING_CATEGORY_VALUES, isShoppingUrl } from '@/lib/shoppingTypes'
import { optionalText, requiredText } from '@/lib/validation'
export const shoppingSchema = z.object({
  name: requiredText(80, '물건 이름을 입력해 주세요'),
  category: z.enum(SHOPPING_CATEGORY_VALUES),
  url: z
    .string()
    .trim()
    .max(2048, '링크는 2,048자까지 입력할 수 있어요')
    .refine(
      (value) => !value || isShoppingUrl(value),
      'http:// 또는 https://로 시작하는 올바른 링크를 입력해 주세요',
    )
    .transform((value) => value || null),
  memo: optionalText(500),
  frequent: z.boolean(),
})
export type ShoppingValues = z.input<typeof shoppingSchema>
