import { z } from 'zod'
import { isValidDateString } from '../domain/date'
export const BACKUP_MAX_BYTES = 10 * 1024 * 1024
export const BACKUP_MAX_ROWS = 20000
const uuid = z.string().uuid()
const date = z.string().refine(isValidDateString, '날짜를 확인해 주세요')
const time = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T/)
  .refine((value) => Number.isFinite(Date.parse(value)), '시각을 확인해 주세요')
const status = z.enum(['not_tried', 'tried', 'caution'])
const text = (max: number) =>
  z
    .string()
    .refine(
      (value) => value.trim().length > 0 && value.trim().length <= max,
      `${max}자 이내의 내용을 입력해 주세요`,
    )
export const BACKUP_LABELS = {
  children: '아이 정보',
  body_measures: '키·몸무게',
  milestones: '발달 기록',
  sleep_logs: '수면',
  foods: '음식',
  photos: '사진 정보',
  recipes: '레시피',
  recipe_ingredients: '레시피 재료',
  meal_entries: '식단',
  meal_entry_foods: '식단 음식',
  meal_entry_recipes: '식단 레시피',
  food_status_history: '음식 상태 이력',
} as const
export type BackupTable = keyof typeof BACKUP_LABELS
export const backupSchema = z
  .object({
    schema_version: z.literal(1),
    exported_at: time,
    source_owner_id: uuid,
    data: z
      .object({
        children: z.array(
          z
            .object({
              birth_date: date,
              created_at: time,
              id: uuid,
              nickname: text(20),
              updated_at: time,
            })
            .strict(),
        ),
        body_measures: z.array(
          z
            .object({
              created_at: time,
              date: date,
              height_cm: z.number().finite().nullable(),
              id: uuid,
              memo: z.string().max(500).nullable(),
              updated_at: time,
              weight_kg: z.number().finite().nullable(),
            })
            .strict(),
        ),
        milestones: z.array(
          z
            .object({
              created_at: time,
              date: date,
              id: uuid,
              memo: z.string().max(500).nullable(),
              title: text(30),
              type: z.enum(['word', 'behavior', 'expression']),
              updated_at: time,
            })
            .strict(),
        ),
        sleep_logs: z.array(
          z
            .object({
              bed_time: time.nullable(),
              created_at: time,
              date: date,
              id: uuid,
              memo: z.string().max(500).nullable(),
              naps: z.array(z.object({ start: time, end: time }).strict()),
              updated_at: time,
              wake_time: time.nullable(),
            })
            .strict(),
        ),
        foods: z.array(
          z
            .object({
              caution_since: date.nullable(),
              caution_tag: z.boolean(),
              check_note: z.string().max(500).nullable(),
              created_at: time,
              first_tried_date: date.nullable(),
              food_group: z.enum(['grain', 'vegetable', 'fruit', 'protein', 'dairy', 'etc']),
              id: uuid,
              is_default: z.boolean(),
              manual_first_tried_date: date.nullable(),
              manual_tried: z.boolean(),
              memo: z.string().max(500).nullable(),
              name: text(20),
              preference: z.enum(['love', 'like', 'neutral', 'refuse']).nullable(),
              reaction_date: date.nullable(),
              status: status,
              symptom_note: z.string().max(500).nullable(),
              updated_at: time,
            })
            .strict(),
        ),
        photos: z.array(
          z
            .object({
              created_at: time,
              id: uuid,
              storage_path: z.string(),
              updated_at: time,
            })
            .strict(),
        ),
        recipes: z.array(
          z
            .object({
              created_at: time,
              id: uuid,
              name: text(30),
              note: z.string().max(500).nullable(),
              photo_id: uuid.nullable(),
              servings: z.string().max(20).nullable(),
              steps: z.array(z.string().refine((value) => value.trim().length > 0)).min(1),
              updated_at: time,
            })
            .strict(),
        ),
        recipe_ingredients: z.array(
          z
            .object({
              amount: z.string().max(20).nullable(),
              created_at: time,
              food_id: uuid.nullable(),
              id: uuid,
              name: text(20),
              position: z.number().int().nonnegative(),
              recipe_id: uuid,
              updated_at: time,
            })
            .strict(),
        ),
        meal_entries: z.array(
          z
            .object({
              created_at: time,
              date: date,
              eaten: z.boolean(),
              id: uuid,
              intake: z.enum(['good', 'normal', 'refuse']).nullable(),
              meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
              memo: z.string().max(500).nullable(),
              updated_at: time,
            })
            .strict(),
        ),
        meal_entry_foods: z.array(
          z
            .object({
              food_id: uuid.nullable(),
              food_name: text(20),
              id: uuid,
              meal_entry_id: uuid,
              position: z.number().int().nonnegative(),
            })
            .strict(),
        ),
        meal_entry_recipes: z.array(
          z
            .object({
              id: uuid,
              meal_entry_id: uuid,
              position: z.number().int().nonnegative(),
              recipe_id: uuid.nullable(),
              recipe_name: text(30),
            })
            .strict(),
        ),
        food_status_history: z.array(
          z
            .object({
              caution_tag: z.boolean(),
              changed_at: time,
              check_note: z.string().max(500).nullable(),
              food_id: uuid,
              from_status: status,
              id: uuid,
              meal_entry_id: uuid.nullable(),
              reaction_date: date.nullable(),
              reason: z.string().max(500).nullable(),
              symptom_note: z.string().max(500).nullable(),
              to_status: status,
              trigger: z.enum(['manual', 'meal_entry', 'revert']),
            })
            .strict(),
        ),
      })
      .strict(),
  })
  .strict()
export type Backup = z.infer<typeof backupSchema>
