export const SHOPPING_CATEGORIES = [
  { value: 'food', label: '음식' },
  { value: 'clothing', label: '의류' },
  { value: 'supplies', label: '생활용품' },
  { value: 'toys', label: '장난감' },
  { value: 'books', label: '도서' },
  { value: 'etc', label: '기타' },
] as const
export type ShoppingCategory = (typeof SHOPPING_CATEGORIES)[number]['value']
export const SHOPPING_CATEGORY_VALUES = SHOPPING_CATEGORIES.map(({ value }) => value)
export type ShoppingStatus = 'pending' | 'purchased' | 'saved'
export function shoppingCategoryLabel(category: ShoppingCategory) {
  return SHOPPING_CATEGORIES.find(({ value }) => value === category)!.label
}
/** 외부 페이지는 직접 열기만 하며 서버나 브라우저에서 미리 가져오지 않는다. */
export function isShoppingUrl(value: string): boolean {
  try {
    if (/\s/.test(value)) return false
    const url = new URL(value)
    return (
      ['https:', 'http:'].includes(url.protocol) && !!url.hostname && !url.username && !url.password
    )
  } catch {
    return false
  }
}
