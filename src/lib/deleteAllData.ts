import { RECIPE_PHOTO_BUCKET } from './photoTypes'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

export type DeleteAllErrorReason = 'auth' | 'photos' | 'records'
export const DELETE_ALL_MESSAGES: Record<DeleteAllErrorReason, string> = {
  auth: '로그인 계정이 바뀌었거나 확인되지 않아요. 로그인 상태를 확인해 주세요',
  photos:
    '사진 정리를 마치지 못했어요. 일부 사진은 이미 삭제됐을 수 있어요. 다시 시도하면 남은 사진부터 정리해요',
  records:
    '기록 삭제를 완료했는지 확인하지 못했어요. 사진은 이미 삭제됐을 수 있어요. 연결을 확인하고 다시 시도해 주세요',
}
export class DeleteAllDataError extends Error {
  readonly reason: DeleteAllErrorReason
  constructor(reason: DeleteAllErrorReason) {
    super(DELETE_ALL_MESSAGES[reason])
    this.reason = reason
  }
}
const PHOTO_NAME = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.jpg$/
export const DELETE_PHOTO_PAGE_SIZE = 100

/** 항상 첫 페이지를 지워 offset 이동으로 파일을 건너뛰지 않는다. 실패·재실행도 같은 경로로 처리한다. */
export async function deleteAllDataFor(supabase: SupabaseClient<Database>): Promise<void> {
  let reason: DeleteAllErrorReason = 'auth'
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) throw new DeleteAllDataError('auth')
    const uid = data.user.id
    reason = 'photos'
    let previous: string | null = null,
      complete = false
    for (let page = 0; page < 1000; page++) {
      const listed = await supabase.storage.from(RECIPE_PHOTO_BUCKET).list(uid, {
        limit: DELETE_PHOTO_PAGE_SIZE,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' },
      })
      if (listed.error || !listed.data) throw new DeleteAllDataError('photos')
      if (listed.data.length === 0) {
        complete = true
        break
      }
      if (listed.data.some((item) => !item.id || !PHOTO_NAME.test(item.name)))
        throw new DeleteAllDataError('photos')
      const names = listed.data.map((item) => item.name),
        fingerprint = [...names].sort().join('|')
      if (fingerprint === previous) throw new DeleteAllDataError('photos')
      const removed = await supabase.storage
        .from(RECIPE_PHOTO_BUCKET)
        .remove(names.map((name) => `${uid}/${name}`))
      if (removed.error) throw new DeleteAllDataError('photos')
      previous = fingerprint
    }
    if (!complete) throw new DeleteAllDataError('photos')
    reason = 'records'
    // 처음 확인한 계정 ID를 서버에도 전달해 다른 탭에서 계정이 바뀌어도 다른 계정을 지우지 않는다.
    const result = await supabase.rpc('delete_all_data', { expected_owner_id: uid })
    if (result.error) {
      if (result.error.message === 'delete_auth') throw new DeleteAllDataError('auth')
      if (result.error.message === 'delete_photos_remaining') throw new DeleteAllDataError('photos')
      // 응답만 유실된 경우 같은 계정의 기록이 모두 비었는지 확인한 뒤 성공으로 처리한다.
      const current = await supabase.auth.getUser()
      if (current.error || current.data.user?.id !== uid) throw new DeleteAllDataError('auth')
      const snapshot = await supabase.rpc('export_backup')
      const payload = snapshot.data
      if (
        !snapshot.error &&
        payload &&
        typeof payload === 'object' &&
        !Array.isArray(payload) &&
        payload.source_owner_id === uid
      ) {
        const rows = payload.data
        if (
          rows &&
          typeof rows === 'object' &&
          !Array.isArray(rows) &&
          Object.keys(rows).length === 12 &&
          Object.values(rows).every((value) => Array.isArray(value) && value.length === 0)
        )
          return
      }
      throw new DeleteAllDataError('records')
    }
  } catch (error) {
    throw error instanceof DeleteAllDataError ? error : new DeleteAllDataError(reason)
  }
}
