import type { KnownRestaurantPost } from '../api/community'
import type { RestaurantListItem } from '../api/restaurants'

/** 비교 시 공백·줄바꿈 무시 + NFKC(호환 문자 통일) — 「서일순대국」↔「서일 순대국」·복붙 변형 */
function compactLower(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, '')
}

/**
 * BroG 지도·목록 클라이언트 필터: 상호·소개·카테고리·대표메뉴·구·시·등록자 닉네임(및 `회원 #id`).
 * 공백으로 나눈 토큰은 모두 부분 일치(AND). 필드·검색어 모두 **공백 무시** 후 비교.
 */
export function restaurantMatchesBroMapSearch(r: RestaurantListItem, rawQuery: string): boolean {
  const q = rawQuery.trim()
  if (!q) return true
  const uidLabel =
    r.submitted_by_user_id != null ? `회원 #${r.submitted_by_user_id}`.toLowerCase() : ''
  const hay = [
    r.name,
    r.summary,
    r.category,
    r.main_menu_name,
    r.district,
    r.city,
    r.submitted_by_nickname,
    uidLabel,
  ]
    .map((x) => (x ?? '').toString())
    .join(' ')
  const hayC = compactLower(hay)
  const tokens = q.split(/\s+/).filter(Boolean)
  return tokens.every((tok) => hayC.includes(compactLower(tok)))
}

/** MyG 지도·목록: 상호·제목·본문·구·대표메뉴·작성자 닉네임·카테고리·요약·시 */
export function knownRestaurantPostMatchesMygMapSearch(p: KnownRestaurantPost, rawQuery: string): boolean {
  const q = rawQuery.trim()
  if (!q) return true
  const hay = [
    p.restaurant_name,
    p.title,
    p.body,
    p.district,
    p.main_menu_name,
    p.author_nickname,
    p.category,
    p.summary,
    p.city,
  ]
    .map((x) => (x ?? '').toString())
    .join(' ')
  const hayC = compactLower(hay)
  const tokens = q.split(/\s+/).filter(Boolean)
  return tokens.every((tok) => hayC.includes(compactLower(tok)))
}
