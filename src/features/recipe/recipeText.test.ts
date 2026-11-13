import { describe, expect, it } from 'vitest'
import {
  ingredientKey,
  ingredientsToText,
  initialIngredientLinks,
  parseRecipeIngredients,
  parseRecipeSteps,
  stepsToText,
} from './recipeText'
import { recipeSchema } from './recipeSchema'
export const ingredientExample = `아기용 만두 3~4개
계란 1개
물 또는 멸치·채소 육수 300ml
애호박 20g
당근 10g
대파 아주 조금
국간장 **1/4~1/3작은술**
참기름 2~3방울
김가루 조금 — 선택`
export const stepsExample = `**1. 채소 준비하기**애호박과 당근은 잘게 채 썰거나 다져줘.

2. **채소 먼저 끓이기**냄비에 육수 300ml와 당근을 넣고 2분 정도 끓인 다음 애호박을 넣어.

3. **만두 넣기**국물이 끓으면 만두 3~4개를 넣고 **중불에서 4~5분 정도** 충분히 익혀줘.
냉동 만두라면 제품 조리시간에 맞춰 속까지 완전히 익혀줘.

4. **간하기**국간장 1/4작은술을 먼저 넣어봐.

5. **계란 풀기**계란 1개를 잘 풀어 넣고 **10~15초 기다렸다가** 살살 저어.

6. 마지막에 대파를 아주 조금 넣고 30초 정도 더 끓인 뒤 불을 꺼.

7. **참기름 2~3방울** 떨어뜨리면 고소해져.`
describe('레시피 텍스트 자동 구분', () => {
  it('사용자 예시의 재료 9개와 범위·분수·자유 양을 보존한다', () => {
    expect(
      parseRecipeIngredients(ingredientExample).map(({ name, amount }) => [name, amount]),
    ).toEqual([
      ['아기용 만두', '3~4개'],
      ['계란', '1개'],
      ['물 또는 멸치·채소 육수', '300ml'],
      ['애호박', '20g'],
      ['당근', '10g'],
      ['대파', '아주 조금'],
      ['국간장', '1/4~1/3작은술'],
      ['참기름', '2~3방울'],
      ['김가루', '조금 — 선택'],
    ])
  })
  it('번호가 있는 조리 순서는 이어지는 문장을 같은 단계로 묶는다', () => {
    const steps = parseRecipeSteps(stepsExample)
    expect(steps).toHaveLength(7)
    expect(steps[0]).toBe('채소 준비하기 애호박과 당근은 잘게 채 썰거나 다져줘.')
    expect(steps[2]).toContain('\n냉동 만두라면')
    expect(steps[2]).toContain('4~5분')
    expect(steps[3]).toContain('1/4작은술')
    expect(steps[4]).toContain('10~15초')
  })
  it('번호 없는 글은 빈 줄을 제외하고 한 줄씩 번호를 붙인다', () => {
    expect(parseRecipeSteps('  씻어요\r\n\r\n- 끓여요\n\n담아요  ')).toEqual([
      '씻어요',
      '끓여요',
      '담아요',
    ])
  })
  it('소수점·분수·시간과 문장 마침표는 단계 경계로 사용하지 않는다', () => {
    expect(parseRecipeSteps('물 1.5L를 넣어요. 1/4컵은 남겨요.\n4~5분 끓여요')).toEqual([
      '물 1.5L를 넣어요. 1/4컵은 남겨요.',
      '4~5분 끓여요',
    ])
    expect(
      parseRecipeIngredients('비타민 B12\n3.5% 우유 100ml').map((i) => [i.name, i.amount]),
    ).toEqual([
      ['비타민 B12', null],
      ['3.5% 우유', '100ml'],
    ])
  })
  it('번호·글머리·복사된 Markdown 이스케이프와 공백을 정리한다', () => {
    expect(parseRecipeSteps('1\\. 씻어요\n\n3) 끓여요\n(4) 담아요')).toEqual([
      '씻어요',
      '끓여요',
      '담아요',
    ])
    expect(
      parseRecipeIngredients('- 쌀 20g\n• 물 100ml&#x20;\n\n2. 소금 | 취향에 맞게').map((i) => [
        i.name,
        i.amount,
      ]),
    ).toEqual([
      ['쌀', '20g'],
      ['물', '100ml'],
      ['소금', '취향에 맞게'],
    ])
  })
  it('저장된 자유 양·다중 줄 단계를 편집용 텍스트로 왕복한다', () => {
    const ingredients = [
      { foodId: null, name: '소금', amount: '입맛에 맞게' },
      { foodId: null, name: '비타민 B12', amount: null },
      { foodId: null, name: '쌀', amount: '20g' },
    ]
    expect(parseRecipeIngredients(ingredientsToText(ingredients))).toEqual(ingredients)
    const steps = ['씻어요\n찬물로 헹궈요', '끓여요']
    expect(parseRecipeSteps(stepsToText(steps))).toEqual(steps)
  })
  it('기존 연결은 순서를 바꿔도 유지하고 이름이 달라지면 사용하지 않는다', () => {
    const items = [
      { foodId: 'f1', name: '쌀', amount: '20g' },
      { foodId: 'f2', name: '물', amount: '100ml' },
    ]
    const links = initialIngredientLinks(items)
    const reordered = parseRecipeIngredients('물 200ml\n쌀 30g\n달걀 1개')
    expect(reordered.map((_, index) => links[ingredientKey(reordered, index)] ?? null)).toEqual([
      'f2',
      'f1',
      null,
    ])
  })
  it('빈 입력·긴 재료/양을 막고 예시는 잘라내지 않고 저장한다', () => {
    const input = {
      name: '만둣국',
      servings: '',
      note: '',
      ingredientsText: ingredientExample,
      stepsText: stepsExample,
    }
    const valid = recipeSchema.parse(input)
    expect(valid.ingredientsText).toHaveLength(9)
    expect(valid.stepsText).toHaveLength(7)
    expect(recipeSchema.safeParse({ ...input, ingredientsText: ' \n\n' }).success).toBe(false)
    expect(recipeSchema.safeParse({ ...input, stepsText: ' \n\n' }).success).toBe(false)
    expect(recipeSchema.safeParse({ ...input, ingredientsText: '가'.repeat(21) }).success).toBe(
      false,
    )
    expect(
      recipeSchema.safeParse({ ...input, ingredientsText: '물 | ' + '가'.repeat(21) }).success,
    ).toBe(false)
  })
})
