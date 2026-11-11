import { beforeEach, describe, expect, it, vi } from 'vitest'
import { notifyMealSaved } from './mealNotify'
import { notifyDone, notifySaved } from './notify'
vi.mock('./notify', () => ({ notifyDone: vi.fn(), notifySaved: vi.fn() }))
beforeEach(() => vi.clearAllMocks())
describe('식단 저장 알림', () => {
  it('반복 저장·계획은 일반 저장 알림만 표시한다', () => {
    notifyMealSaved({ id: 'm1', firstTriedFoods: [] })
    expect(notifySaved).toHaveBeenCalledOnce()
    expect(notifyDone).not.toHaveBeenCalled()
  })
  it.each([
    ['쌀', '쌀을'],
    ['브로콜리', '브로콜리를'],
  ])('첫 시도 %s에 맞는 조사를 붙이고 일반 알림은 생략한다', (name, subject) => {
    notifyMealSaved({ id: 'm1', firstTriedFoods: [{ id: 'f1', name }] })
    expect(notifyDone).toHaveBeenCalledExactlyOnceWith(`${subject} 처음 먹었어요`)
    expect(notifySaved).not.toHaveBeenCalled()
  })
})
