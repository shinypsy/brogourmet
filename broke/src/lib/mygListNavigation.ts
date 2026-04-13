/** MyG 리스트로 돌아갈 때 구 필터 유지(BroG `brogListNavigation`과 대응) */

export const MYG_LIST_LAST_QUERY_KEY = 'myg_list_last_query'

export function persistMygListQuery(district: string): void {
  try {
    const p = new URLSearchParams()
    p.set('district', district)
    sessionStorage.setItem(MYG_LIST_LAST_QUERY_KEY, p.toString())
  } catch {
    /* */
  }
}

export function getMygListNavigatePath(): string {
  try {
    const q = sessionStorage.getItem(MYG_LIST_LAST_QUERY_KEY)
    if (q) return `/known-restaurants/list?${q}`
  } catch {
    /* */
  }
  return '/known-restaurants/list'
}

export const MYG_LIST_REFRESH_STATE_KEY = 'mygListRefreshAt' as const

export function mygListRefreshNavigateState(): { mygListRefreshAt: number } {
  return { mygListRefreshAt: Date.now() }
}
