import { requestJson } from './http'

/** 서버·폼 공통: 대표 이미지 최대 장수 */
export const SPONSOR_MAX_IMAGES = 4

export type SponsorPost = {
  id: number
  author_id: number
  title: string
  excerpt: string
  body: string
  accent: string
  image_urls: string[]
  external_url: string | null
  latitude: number | null
  longitude: number | null
  author_nickname: string
  created_at: string
  updated_at: string
}

export type SponsorPostCreatePayload = {
  title: string
  excerpt: string
  body: string
  accent: string
  image_urls: string[]
  external_url: string | null
  latitude: number | null
  longitude: number | null
}

function qs(params: Record<string, string | number | undefined | null>): string {
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    u.set(k, String(v))
  }
  const s = u.toString()
  return s ? `?${s}` : ''
}

export async function fetchSponsorPosts(options: {
  q?: string
  lat?: number | null
  lng?: number | null
}): Promise<SponsorPost[]> {
  const path = `/sponsors/posts${qs({
    q: options.q?.trim() || undefined,
    lat: options.lat != null && Number.isFinite(options.lat) ? options.lat : undefined,
    lng: options.lng != null && Number.isFinite(options.lng) ? options.lng : undefined,
  })}`
  return requestJson<SponsorPost[]>(path)
}

export async function fetchSponsorPost(id: number): Promise<SponsorPost> {
  return requestJson<SponsorPost>(`/sponsors/posts/${id}`)
}

export async function createSponsorPost(
  token: string,
  payload: SponsorPostCreatePayload,
): Promise<SponsorPost> {
  return requestJson<SponsorPost>('/sponsors/posts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
}

export async function updateSponsorPost(
  token: string,
  id: number,
  payload: Partial<SponsorPostCreatePayload>,
): Promise<SponsorPost> {
  return requestJson<SponsorPost>(`/sponsors/posts/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
}

export async function deleteSponsorPost(token: string, id: number): Promise<void> {
  await requestJson<unknown>(`/sponsors/posts/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}
