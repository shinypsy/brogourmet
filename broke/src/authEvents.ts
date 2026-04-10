export const AUTH_CHANGE_EVENT = 'brogourmet-auth-change'

export function notifyAuthChange(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT))
}
