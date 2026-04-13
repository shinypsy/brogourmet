export const AUTH_CHANGE_EVENT = 'brogourmet-auth-change'

/** 로그인 유지 상태에서 `/users/me` 재조회(포인트 적립 등) */
export const USER_PROFILE_REFRESH_EVENT = 'brogourmet-user-profile-refresh'

export function notifyAuthChange(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT))
}

export function notifyUserProfileRefresh(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(USER_PROFILE_REFRESH_EVENT))
}
