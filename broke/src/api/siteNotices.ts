import { ACCESS_TOKEN_KEY } from './config'
import { requestJson } from './http'

export type SiteNoticeItem = {
  slot: number
  title: string
  body: string
  updated_at: string | null
}

export async function fetchSiteNotices(): Promise<SiteNoticeItem[]> {
  return requestJson<SiteNoticeItem[]>('/site-notices')
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY)
  if (!token) throw new Error('로그인이 필요합니다.')
  return { Authorization: `Bearer ${token}` }
}

export async function fetchAdminSiteNotices(): Promise<SiteNoticeItem[]> {
  return requestJson<SiteNoticeItem[]>('/admin/site-notices', { headers: authHeaders() })
}

export type SiteNoticeDraft = { slot: number; title: string; body: string }

export async function putAdminSiteNotices(items: SiteNoticeDraft[]): Promise<SiteNoticeItem[]> {
  return requestJson<SiteNoticeItem[]>('/admin/site-notices', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ items }),
  })
}
