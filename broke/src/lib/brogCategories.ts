/** BroG 작성·수정 시 선택 가능한 음식 카테고리 (API RestaurantWrite와 동일) */
export const BROG_CATEGORIES = [
  '한식',
  '중식',
  '일식',
  '양식',
  '분식',
  '패스트푸드',
  '음료',
] as const

export type BrogCategory = (typeof BROG_CATEGORIES)[number]

export function isBrogCategory(value: string): value is BrogCategory {
  return (BROG_CATEGORIES as readonly string[]).includes(value)
}
