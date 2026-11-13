import type { Tables } from './database.types'
import { supabase } from './supabase'

export interface RecipeIngredient {
  foodId: string | null
  name: string
  amount: string | null
}
export interface RecipeInput {
  name: string
  servings: string | null
  ingredients: RecipeIngredient[]
  steps: string[]
  note: string | null
  photoId: string | null
}
export interface Recipe extends RecipeInput {
  id: string
}

const COLUMNS =
  'id,name,servings,steps,note,photo_id,recipe_ingredients(food_id,name,amount,position)'
type Row = Pick<Tables<'recipes'>, 'id' | 'name' | 'servings' | 'steps' | 'note' | 'photo_id'> & {
  recipe_ingredients: Pick<
    Tables<'recipe_ingredients'>,
    'food_id' | 'name' | 'amount' | 'position'
  >[]
}
function toRecipe(row: Row): Recipe {
  if (!Array.isArray(row.steps) || row.steps.some((step) => typeof step !== 'string'))
    throw new Error('조리 순서를 읽지 못했어요')
  return {
    id: row.id,
    name: row.name,
    servings: row.servings,
    steps: row.steps as string[],
    note: row.note,
    photoId: row.photo_id,
    ingredients: [...row.recipe_ingredients]
      .sort((a, b) => a.position - b.position)
      .map((i) => ({ foodId: i.food_id, name: i.name, amount: i.amount })),
  }
}
export async function fetchRecipes(): Promise<Recipe[]> {
  const { data, error } = await supabase.from('recipes').select(COLUMNS)
  if (error) throw error
  return data
    .map(toRecipe)
    .sort((a, b) => a.name.localeCompare(b.name, 'ko') || a.id.localeCompare(b.id))
}
export async function fetchRecipe(id: string): Promise<Recipe | null> {
  const { data, error } = await supabase.from('recipes').select(COLUMNS).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toRecipe(data) : null
}
export class RecipeSaveError extends Error {
  readonly reason: 'validation' | 'notFound' | 'network'
  constructor(reason: 'validation' | 'notFound' | 'network') {
    super(reason)
    this.reason = reason
  }
}
/** 폼 시작 시 ID를 고정해 응답 유실 후 재시도해도 중복 생성하지 않는다. */
export async function saveRecipe(
  id: string,
  input: RecipeInput,
  createNew: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('save_recipe', {
    id,
    name: input.name,
    servings: input.servings ?? undefined,
    steps: input.steps,
    note: input.note ?? undefined,
    photo_id: input.photoId ?? undefined,
    create_new: createNew,
    ingredients: input.ingredients.map((i) => ({
      food_id: i.foodId,
      name: i.name,
      amount: i.amount,
    })),
  })
  if (error)
    throw new RecipeSaveError(
      error.code === 'P0002'
        ? 'notFound'
        : ['22023', '23514', '23503', '22P02'].includes(error.code)
          ? 'validation'
          : 'network',
    )
}
export async function deleteRecipe(id: string): Promise<void> {
  const { error } = await supabase.from('recipes').delete().eq('id', id)
  if (error) throw error
}
