import { supabase } from './supabase'
import type { Tables } from './database.types'

export interface PreparationTask {
  id: string
  name: string
  dueDate: string | null
  memo: string | null
  url: string | null
  completed: boolean
}
export type TaskInput = Omit<PreparationTask, 'id' | 'completed'>
const COLUMNS = 'id, name, due_date, memo, url, completed'
function toTask(
  row: Pick<Tables<'preparation_tasks'>, 'id' | 'name' | 'due_date' | 'memo' | 'url' | 'completed'>,
): PreparationTask {
  return {
    id: row.id,
    name: row.name,
    dueDate: row.due_date,
    memo: row.memo,
    url: row.url,
    completed: row.completed,
  }
}
export async function fetchTasks(): Promise<PreparationTask[]> {
  const { data, error } = await supabase
    .from('preparation_tasks')
    .select(COLUMNS)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('updated_at', { ascending: false })
    .order('id')
  if (error) throw error
  return data.map(toTask)
}
export async function fetchTask(id: string): Promise<PreparationTask | null> {
  const { data, error } = await supabase
    .from('preparation_tasks')
    .select(COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? toTask(data) : null
}
/** 내용 수정은 다른 화면에서 바꾼 완료 상태를 덮어쓰지 않는다. */
export async function saveTask(input: TaskInput, id?: string): Promise<PreparationTask> {
  const row = { name: input.name, due_date: input.dueDate, memo: input.memo, url: input.url }
  const request = id
    ? supabase.from('preparation_tasks').update(row).eq('id', id)
    : supabase.from('preparation_tasks').insert(row)
  const { data, error } = await request.select(COLUMNS).single()
  if (error) throw error
  return toTask(data)
}
export async function setTaskCompleted(id: string, completed: boolean): Promise<PreparationTask> {
  const { data, error } = await supabase
    .from('preparation_tasks')
    .update({ completed })
    .eq('id', id)
    .select(COLUMNS)
    .single()
  if (error) throw error
  return toTask(data)
}
export async function deleteTask(id: string): Promise<void> {
  const { data, error } = await supabase
    .from('preparation_tasks')
    .delete()
    .eq('id', id)
    .select('id')
    .single()
  if (error || !data) throw error ?? new Error('notFound')
}
