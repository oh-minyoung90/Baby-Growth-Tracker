import { supabase } from './supabase'
import { deleteAllDataFor } from './deleteAllData'
export { DeleteAllDataError, DELETE_ALL_MESSAGES, DELETE_PHOTO_PAGE_SIZE } from './deleteAllData'

export function deleteAllData(): Promise<void> {
  return deleteAllDataFor(supabase)
}
