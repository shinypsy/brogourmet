import { requestJson } from './http'

/** 이벤트 등록 후 티커 등에서 `window.dispatchEvent` 로 사용 */
export const SITE_EVENT_UPDATED = 'brog:site-event-updated'

export type SiteEventRead = {
  id: number
  author_id: number | null
  body: string
  is_active: boolean
  created_at: string
}

export async function fetchEventTicker(): Promise<{ text: string }> {
  return requestJson<{ text: string }>('/events/ticker')
}

export async function createSiteEvent(token: string, body: string): Promise<SiteEventRead> {
  return requestJson<SiteEventRead>('/events', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ body }),
  })
}

export async function listSiteEvents(token: string): Promise<SiteEventRead[]> {
  return requestJson<SiteEventRead[]>('/events', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function deactivateSiteEvent(token: string, id: number): Promise<SiteEventRead> {
  return requestJson<SiteEventRead>(`/events/${id}/deactivate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function deleteSiteEvent(token: string, id: number): Promise<void> {
  await requestJson<void>(`/events/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}
