import { describe, expect, it } from 'vitest'
import type { Food } from './foodApi'
import { mealCautionFoods } from './mealCaution'

const food = (id: string, status: Food['status'], cautionTag = false) =>
  ({ id, name: id, status, cautionTag }) as Food
const catalog = [food('egg', 'caution'), food('milk', 'tried', true), food('rice', 'tried')]

describe('식단 주의 음식 판단', () => {
  it('현재 음식 상태로 주의·태그를 판단하고 정상 음식과 삭제된 이름은 제외한다', () => {
    expect(
      mealCautionFoods(
        [
          { id: 'egg', name: '예전 이름' },
          { id: 'milk', name: '우유' },
          { id: 'rice', name: '쌀' },
          { id: null, name: 'egg' },
        ],
        [],
        catalog,
      ).map((item) => item.id),
    ).toEqual(['egg', 'milk'])
  })
  it('레시피 재료도 확인하고 직접 선택·여러 레시피의 같은 재료는 한 번만 경고한다', () => {
    const recipes = [
      {
        id: 'r1',
        name: '죽',
        ingredients: [
          { id: 'egg', name: '달걀' },
          { id: 'milk', name: '우유' },
        ],
      },
      { id: 'r2', name: '빵', ingredients: [{ id: 'egg', name: '달걀' }] },
    ]
    expect(
      mealCautionFoods([{ id: 'egg', name: '달걀' }], recipes, catalog, recipes).map(
        (item) => item.id,
      ),
    ).toEqual(['egg', 'milk'])
    expect(mealCautionFoods([], [{ id: null, name: '죽' }], catalog, recipes)).toEqual([])
  })
})
