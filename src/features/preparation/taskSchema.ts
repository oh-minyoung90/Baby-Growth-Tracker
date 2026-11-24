import { z } from 'zod'
import { isValidDateString } from '@/domain/date'
import { optionalText, requiredText } from '@/lib/validation'
import { shoppingSchema } from '@/features/shopping/shoppingSchema'
export const taskSchema = z.object({
  name: requiredText(80, '해야 할 일을 입력해 주세요'),
  dueDate: z
    .string()
    .refine((value) => !value || isValidDateString(value), '날짜를 다시 확인해 주세요')
    .transform((value) => value || null),
  memo: optionalText(500),
  url: shoppingSchema.shape.url,
})
export type TaskValues = z.input<typeof taskSchema>
