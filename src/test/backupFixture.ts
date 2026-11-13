import type { Backup } from '../lib/backupSchema'
export const BACKUP_TEST_OWNER = '00000000-0000-4000-8000-000000000001'
export function emptyBackup(ownerId = BACKUP_TEST_OWNER): Backup {
  return {
    schema_version: 1,
    exported_at: '2026-10-02T12:00:00Z',
    source_owner_id: ownerId,
    data: {
      children: [],
      body_measures: [],
      milestones: [],
      sleep_logs: [],
      foods: [],
      photos: [],
      recipes: [],
      recipe_ingredients: [],
      meal_entries: [],
      meal_entry_foods: [],
      meal_entry_recipes: [],
      food_status_history: [],
    },
  }
}
/** 전체 테이블·연결·사진 경로가 들어 있는 가명 예시. 실제 사용자 정보를 사용하지 않는다. */
export function exampleBackup(ownerId = BACKUP_TEST_OWNER): Backup {
  const backup = emptyBackup(ownerId),
    id = () => crypto.randomUUID(),
    stamp = { created_at: '2026-10-02T12:00:00Z', updated_at: '2026-10-02T12:00:00Z' }
  const food = id(),
    photo = id(),
    recipe = id(),
    meal = id()
  backup.data.children = [
    { id: id(), nickname: '백업예시아기', birth_date: '2026-01-08', ...stamp },
  ]
  backup.data.body_measures = [
    { id: id(), date: '2026-10-01', height_cm: 72, weight_kg: 8.8, memo: '가명 측정', ...stamp },
  ]
  backup.data.milestones = [
    { id: id(), date: '2026-10-01', type: 'word', title: '안녕', memo: null, ...stamp },
  ]
  backup.data.sleep_logs = [
    {
      id: id(),
      date: '2026-10-01',
      bed_time: '2026-10-01T21:00:00',
      wake_time: '2026-10-02T06:00:00',
      naps: [{ start: '2026-10-01T14:00:00', end: '2026-10-01T15:00:00' }],
      memo: null,
      ...stamp,
    },
  ]
  backup.data.foods = [
    {
      id: food,
      name: '예시 쌀',
      food_group: 'grain',
      status: 'tried',
      caution_tag: false,
      first_tried_date: '2026-10-01',
      manual_tried: true,
      manual_first_tried_date: '2026-10-01',
      preference: 'like',
      memo: null,
      reaction_date: null,
      symptom_note: null,
      check_note: null,
      caution_since: null,
      is_default: false,
      ...stamp,
    },
  ]
  backup.data.photos = [{ id: photo, storage_path: `${ownerId}/${photo}.jpg`, ...stamp }]
  backup.data.recipes = [
    {
      id: recipe,
      name: '예시 쌀죽',
      servings: '2회분',
      steps: ['쌀을 씻어요', '물을 넣고 끓여요'],
      note: '백업 사진 예시',
      photo_id: photo,
      ...stamp,
    },
  ]
  backup.data.recipe_ingredients = [
    {
      id: id(),
      recipe_id: recipe,
      food_id: food,
      name: '예시 쌀',
      amount: '30g',
      position: 0,
      ...stamp,
    },
  ]
  backup.data.meal_entries = [
    {
      id: meal,
      date: '2026-10-02',
      meal_type: 'breakfast',
      eaten: false,
      intake: null,
      memo: '계획 메모',
      ...stamp,
    },
  ]
  backup.data.meal_entry_foods = [
    { id: id(), meal_entry_id: meal, food_id: food, food_name: '예시 쌀', position: 0 },
  ]
  backup.data.meal_entry_recipes = [
    { id: id(), meal_entry_id: meal, recipe_id: recipe, recipe_name: '예시 쌀죽', position: 0 },
  ]
  backup.data.food_status_history = [
    {
      id: id(),
      food_id: food,
      from_status: 'not_tried',
      to_status: 'tried',
      caution_tag: false,
      trigger: 'manual',
      changed_at: stamp.created_at,
      meal_entry_id: meal,
      reason: '가명 이력',
      reaction_date: null,
      symptom_note: null,
      check_note: null,
    },
  ]
  return backup
}
