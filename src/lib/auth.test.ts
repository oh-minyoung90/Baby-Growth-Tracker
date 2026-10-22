import { describe, expect, it, vi } from 'vitest'
import { signOut } from './auth'
import { supabase } from './supabase'

// 로그아웃 (T-11, FR-SET-08)
vi.mock('./supabase', () => ({ supabase: { auth: { signOut: vi.fn() } } }))

describe('signOut', () => {
  it('이 기기에서만 로그아웃한다 (다른 기기 로그인은 유지)', async () => {
    const supabaseSignOut = vi.mocked(supabase.auth.signOut)
    supabaseSignOut.mockResolvedValue({ error: null })
    expect(await signOut()).toEqual({ ok: true })
    expect(supabaseSignOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('요청이 실패하면 실패로 알린다', async () => {
    vi.mocked(supabase.auth.signOut).mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await signOut()).toEqual({ ok: false })
  })
})
