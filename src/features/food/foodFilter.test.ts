import { describe, expect, it } from 'vitest'
import type { Food } from '@/lib/foodApi'
import {
  countByStatus,
  filterFoods,
  filterFromParams,
  filterToParams,
  findSameName,
  firstLine,
} from './foodFilter'

// 음식 목록 탭·필터·검색 (FR-FOOD-01~03)

function food(values: Partial<Food> & Pick<Food, 'id' | 'name'>): Food {
  return {
    group: 'vegetable',
    status: 'not_tried',
    cautionTag: false,
    firstTriedDate: null,
    manualTried: false,
    manualFirstTriedDate: null,
    preference: null,
    memo: null,
    reactionDate: null,
    symptomNote: null,
    checkNote: null,
    ...values,
  }
}

const foods = [
  food({ id: '1', name: '단호박', status: 'tried' }),
  food({ id: '2', name: '달걀노른자', group: 'protein', status: 'tried', cautionTag: true }),
  food({ id: '3', name: 'Oat Milk', group: 'dairy' }),
  food({ id: '4', name: '블루베리', group: 'fruit' }),
  food({ id: '5', name: '땅콩', group: 'etc', status: 'caution' }),
]

describe('countByStatus', () => {
  it('상태별 전체 개수를 센다', () => {
    expect(countByStatus(foods)).toEqual({ tried: 2, not_tried: 2, caution: 1 })
    expect(countByStatus([])).toEqual({ tried: 0, not_tried: 0, caution: 0 })
  })
})

describe('filterFoods', () => {
  const ids = (list: Food[]) => list.map((item) => item.id)

  it('상태 탭과 식품군으로 거른다', () => {
    expect(ids(filterFoods(foods, { status: 'tried', group: 'all', query: '' }))).toEqual([
      '1',
      '2',
    ])
    expect(ids(filterFoods(foods, { status: 'tried', group: 'protein', query: '' }))).toEqual(['2'])
    expect(filterFoods(foods, { status: 'caution', group: 'fruit', query: '' })).toEqual([])
  })

  it('이름 검색은 띄어쓰기·대소문자를 무시하고 포함 여부로 찾는다', () => {
    expect(ids(filterFoods(foods, { status: 'not_tried', group: 'all', query: 'oatm' }))).toEqual([
      '3',
    ])
    expect(ids(filterFoods(foods, { status: 'tried', group: 'all', query: ' 노른 ' }))).toEqual([
      '2',
    ])
    expect(ids(filterFoods(foods, { status: 'tried', group: 'all', query: '   ' }))).toEqual([
      '1',
      '2',
    ])
  })
})

describe('filterFromParams / filterToParams', () => {
  it('기본값은 먹어봄·전체이고, 알 수 없는 값은 기본값으로 본다', () => {
    expect(filterFromParams(new URLSearchParams(''))).toEqual({ status: 'tried', group: 'all' })
    expect(filterFromParams(new URLSearchParams('status=eaten&group=meat'))).toEqual({
      status: 'tried',
      group: 'all',
    })
    expect(filterFromParams(new URLSearchParams('status=caution&group=fruit'))).toEqual({
      status: 'caution',
      group: 'fruit',
    })
  })

  it('다른 검색 조건은 두고, 기본값은 주소에서 뺀다', () => {
    const params = new URLSearchParams('record=new&status=caution&group=fruit')
    expect(filterToParams(params, { status: 'tried', group: 'all' }).toString()).toBe('record=new')
    expect(filterToParams(params, { status: 'not_tried', group: 'dairy' }).toString()).toBe(
      'record=new&status=not_tried&group=dairy',
    )
  })
})

describe('findSameName', () => {
  it('띄어쓰기·대소문자만 다른 이름을 찾고, 수정 중인 음식 자신은 뺀다 (BR-18)', () => {
    expect(findSameName(foods, ' oat  MILK ')?.id).toBe('3')
    expect(findSameName(foods, 'Oat Milk', '3')).toBeUndefined()
    expect(findSameName(foods, '오트')).toBeUndefined()
    expect(findSameName(foods, '  ')).toBeUndefined()
  })
})

describe('firstLine', () => {
  it('비어 있지 않은 첫 줄을 돌려준다', () => {
    expect(firstLine('입 주변 두드러기\n30분 후 사라짐')).toBe('입 주변 두드러기')
    expect(firstLine('\n  \n 붉어짐 ')).toBe('붉어짐')
    expect(firstLine(null)).toBeNull()
    expect(firstLine('  ')).toBeNull()
  })
})
