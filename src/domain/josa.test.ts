import { describe, expect, it } from 'vitest'
import { hasFinalConsonant, withObjectParticle, withTopicParticle } from './josa'

describe('withTopicParticle (은/는)', () => {
  it.each([
    ['하늘이', '하늘이는'],
    ['예서', '예서는'],
    ['민준', '민준은'],
    ['우리 아이', '우리 아이는'],
    [' 콩 ', '콩은'],
  ])('%s → %s', (word, expected) => {
    expect(withTopicParticle(word)).toBe(expected)
  })

  it('한글이 아니면 두 조사를 함께 쓴다', () => {
    expect(withTopicParticle('Leo')).toBe('Leo은(는)')
  })
})

describe('withObjectParticle (을/를)', () => {
  it.each([
    ['달걀', '달걀을'],
    ['우유', '우유를'],
    [' 흰살생선 ', '흰살생선을'],
    ['MCT oil', 'MCT oil을(를)'],
  ])('%s → %s', (word, expected) => {
    expect(withObjectParticle(word)).toBe(expected)
  })
})

describe('hasFinalConsonant', () => {
  it('빈 문자열이면 판단할 수 없다', () => {
    expect(hasFinalConsonant('')).toBeNull()
  })
})
