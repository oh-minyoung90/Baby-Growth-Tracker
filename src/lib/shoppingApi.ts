import { supabase } from './supabase'
import type { Tables } from './database.types'
import type { ShoppingCategory, ShoppingStatus } from './shoppingTypes'

export interface ShoppingItem {
  id: string
  name: string
  category: ShoppingCategory
  url: string | null
  memo: string | null
  frequent: boolean
  status: ShoppingStatus
}
export type ShoppingInput = Omit<ShoppingItem, 'id' | 'status'>
const COLUMNS = 'id, name, category, url, memo, is_frequent, status'
function toItem(
  row: Pick<
    Tables<'shopping_items'>,
    'id' | 'name' | 'category' | 'url' | 'memo' | 'is_frequent' | 'status'
  >,
): ShoppingItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category as ShoppingCategory,
    url: row.url,
    memo: row.memo,
    frequent: row.is_frequent,
    status: row.status as ShoppingStatus,
  }
}
export async function fetchShoppingItems(): Promise<ShoppingItem[]> {
  const { data, error } = await supabase
    .from('shopping_items')
    .select(COLUMNS)
    .order('updated_at', { ascending: false })
    .order('id')
  if (error) throw error
  return data.map(toItem)
}
export async function fetchShoppingItem(id: string): Promise<ShoppingItem | null> {
  const { data, error } = await supabase
    .from('shopping_items')
    .select(COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? toItem(data) : null
}
/** 수정은 상태를 덮어쓰지 않아 다른 화면에서 바꾼 구매 체크를 유지한다. */
export async function saveShoppingItem(
  input: ShoppingInput,
  id?: string,
  savedOnly = false,
): Promise<ShoppingItem> {
  const row = {
    name: input.name,
    category: input.category,
    url: input.url,
    memo: input.memo,
    is_frequent: input.frequent,
  }
  const request = id
    ? supabase.from('shopping_items').update(row).eq('id', id)
    : supabase.from('shopping_items').insert({ ...row, status: savedOnly ? 'saved' : 'pending' })
  const { data, error } = await request.select(COLUMNS).single()
  if (error) throw error
  return toItem(data)
}
export async function setShoppingStatus(
  id: string,
  status: 'pending' | 'purchased',
): Promise<ShoppingItem> {
  const { data, error } = await supabase
    .from('shopping_items')
    .update({ status })
    .eq('id', id)
    .select(COLUMNS)
    .single()
  if (error) throw error
  return toItem(data)
}
export async function deleteShoppingItem(id: string): Promise<void> {
  const { data, error } = await supabase
    .from('shopping_items')
    .delete()
    .eq('id', id)
    .select('id')
    .single()
  if (error || !data) throw error ?? new Error('notFound')
}
