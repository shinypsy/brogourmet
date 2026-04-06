export const AUTH_CHANGE_EVENT = 'brogourmet-auth-change'

export function notifyAuthChange(): void {
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT))
}
