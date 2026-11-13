import type { RecipeIngredient } from '@/lib/recipeApi'

function cleanLine(line: string): string {
  return line
    .replace(/&nbsp;|&#(?:x20|32|160);/gi, ' ')
    .replace(/\\([.()~*_-])/g, '$1')
    .replace(
      /\*\*(.+?)\*\*|__(.+?)__/g,
      (_, bold: string | undefined, underline: string | undefined) => `${bold ?? underline} `,
    )
    .trim()
}
function numberedLine(line: string): string | null {
  const match = line.match(
    /^(?:\d{1,3}[.)．](?:\s+|(?=[^\d\s])|$)|\(\d{1,3}\)\s*|\d{1,3}단계\s*[:.)]\s*)(.*)$/,
  )
  return match ? match[1].trim() : null
}
function stripBullet(line: string): string {
  return line.replace(/^[-*+•●]\s+/, '')
}
const linesOf = (text: string) => text.replace(/\r\n?/g, '\n').split('\n').map(cleanLine)

/** 번호가 있는 글은 다음 번호까지 한 단계. 번호가 없으면 비어 있지 않은 줄마다 한 단계. */
export function parseRecipeSteps(text: string): string[] {
  const lines = linesOf(text)
  if (!lines.some((line) => numberedLine(line) !== null))
    return lines
      .map(stripBullet)
      .map((line) => line.trim())
      .filter(Boolean)
  const steps: string[] = []
  let current: string[] = []
  const flush = () => {
    const value = current.join('\n').trim()
    if (value) steps.push(value)
    current = []
  }
  for (const line of lines) {
    const numbered = numberedLine(line)
    if (numbered !== null) {
      flush()
      current.push(numbered)
    } else current.push(line)
  }
  flush()
  return steps
}

// 양은 숫자+단위 또는 정량 표현으로 시작할 때만 나눈다. '비타민 B12', 소수점 등은 이름에 남긴다.
const QUANTITY =
  /\s+((?:(?:약\s*)?\d+(?:[./]\d+)?(?:\s*[~–-]\s*\d+(?:[./]\d+)?)?\s*(?:kg|mg|ml|mL|g|l|L|개|큰술|작은술|스푼|컵|장|줄기|쪽|알|봉|팩|방울|꼬집|줌|공기|마리|인분|회분|티스푼|테이블스푼)|(?:아주\s+)?조금|약간|적당량|적당히|취향껏|한\s*(?:꼬집|줌))).*$/i
export function parseRecipeIngredients(text: string): RecipeIngredient[] {
  return linesOf(text)
    .map((line) => stripBullet(numberedLine(line) ?? line))
    .filter(Boolean)
    .map((line) => {
      const divider = line.indexOf('|')
      if (divider >= 0)
        return {
          foodId: null,
          name: line.slice(0, divider).trim(),
          amount: line.slice(divider + 1).trim() || null,
        }
      const quantity = line.match(QUANTITY)
      if (!quantity || quantity.index === undefined)
        return { foodId: null, name: line, amount: null }
      return {
        foodId: null,
        name: line.slice(0, quantity.index).trim(),
        amount: line.slice(quantity.index).trim() || null,
      }
    })
}
/** 이름·양을 다시 읽어도 동일하도록 모호한 항목은 명시적 구분자를 사용한다. */
export function ingredientsToText(ingredients: readonly RecipeIngredient[]): string {
  return ingredients
    .map((item) => {
      const plain = [item.name, item.amount].filter(Boolean).join(' ')
      const parsed = parseRecipeIngredients(plain)[0]
      return parsed?.name === item.name && parsed.amount === item.amount
        ? plain
        : `${item.name} | ${item.amount ?? ''}`
    })
    .join('\n')
}
export function stepsToText(steps: readonly string[]): string {
  return steps.map((text, index) => `${index + 1}. ${text}`).join('\n\n')
}
/** 텍스트 줄 순서를 바꿔도 음식 연결을 유지하고 이름 변경 시에는 연결하지 않는다. */
export function ingredientKey(ingredients: readonly RecipeIngredient[], index: number): string {
  const name = ingredients[index].name
  return JSON.stringify([name, ingredients.slice(0, index).filter((i) => i.name === name).length])
}
export function initialIngredientLinks(
  ingredients: readonly RecipeIngredient[],
): Record<string, string | null> {
  return Object.fromEntries(
    ingredients.map((item, index) => [ingredientKey(ingredients, index), item.foodId]),
  )
}
