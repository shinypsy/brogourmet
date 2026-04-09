/** BroG 리스트로 돌아갈 때 구·시 필터 유지 */

export const BROG_LIST_LAST_QUERY_KEY = 'brog_list_last_query'

export function persistBrogListQuery(city: string, district: string): void {
  try {
    const p = new URLSearchParams()
    p.set('city', city)
    p.set('district', district)
    sessionStorage.setItem(BROG_LIST_LAST_QUERY_KEY, p.toString())
  } catch {
    /* private mode 등 */
  }
}

/** 상세·관리에서 목록으로 복귀할 때 마지막으로 본 리스트 쿼리(없으면 기본 경로) */
export function getBrogListNavigatePath(): string {
  try {
    const q = sessionStorage.getItem(BROG_LIST_LAST_QUERY_KEY)
    if (q) return `/brog/list?${q}`
  } catch {
    /* */
  }
  return '/brog/list'
}

/** 상세에서 삭제 후 목록이 서버 데이터로 다시 받아지도록 navigate state에 넣는 키 */
export const BROG_LIST_REFRESH_STATE_KEY = 'brogListRefreshAt' as const

export function brogListRefreshNavigateState(): { brogListRefreshAt: number } {
  return { brogListRefreshAt: Date.now() }
}
