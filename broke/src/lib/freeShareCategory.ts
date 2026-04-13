/** 무료나눔 분류 — API `share_category` 값과 동일 */
export const FREE_SHARE_CATEGORY_VALUES = ['food', 'appliance', 'furniture', 'books', 'other'] as const

export type FreeShareCategoryValue = (typeof FREE_SHARE_CATEGORY_VALUES)[number]

export const FREE_SHARE_CATEGORY_LABELS: Record<FreeShareCategoryValue, string> = {
  food: '음식',
  appliance: '가전',
  furniture: '가구',
  books: '도서',
  other: '기타',
}

export function isFreeShareCategoryValue(v: string): v is FreeShareCategoryValue {
  return (FREE_SHARE_CATEGORY_VALUES as readonly string[]).includes(v)
}

export function normalizeFreeShareCategory(v: string | null | undefined): FreeShareCategoryValue {
  if (v && isFreeShareCategoryValue(v)) return v
  return 'other'
}
