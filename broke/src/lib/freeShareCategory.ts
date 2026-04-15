/** 무료나눔 분류 — API `share_category` 값과 동일 (`qa`는 Q&A 전용 보드) */
export const FREE_SHARE_CATEGORY_VALUES = ['food', 'appliance', 'furniture', 'books', 'other', 'qa'] as const

export type FreeShareCategoryValue = (typeof FREE_SHARE_CATEGORY_VALUES)[number]

/** 무료나눔 보드 전용 — Q&A(`qa`) 글은 `/qna`에서만 다룸 */
export const FREE_SHARE_CATEGORY_VALUES_FOR_FREE_BOARD = FREE_SHARE_CATEGORY_VALUES.filter(
  (v): v is Exclude<FreeShareCategoryValue, 'qa'> => v !== 'qa',
)

export const FREE_SHARE_CATEGORY_LABELS: Record<FreeShareCategoryValue, string> = {
  food: '음식',
  appliance: '가전',
  furniture: '가구',
  books: '도서',
  other: '기타',
  qa: 'Q&A',
}

export function isFreeShareCategoryValue(v: string): v is FreeShareCategoryValue {
  return (FREE_SHARE_CATEGORY_VALUES as readonly string[]).includes(v)
}

export function normalizeFreeShareCategory(v: string | null | undefined): FreeShareCategoryValue {
  if (v && isFreeShareCategoryValue(v)) return v
  return 'other'
}
