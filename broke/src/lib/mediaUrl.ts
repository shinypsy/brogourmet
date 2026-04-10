import { API_BASE_URL } from '../api/config'

/** 목록·카드용: `image_urls` 중 첫 비어 있지 않은 값, 없으면 `image_url` */
export function firstRestaurantListImageUrl(r: {
  image_url?: string | null
  image_urls?: string[] | null
}): string | null {
  const raw = r.image_urls
  const list = Array.isArray(raw) ? raw : []
  const urls = list
    .map((u) => (typeof u === 'string' ? u.trim() : ''))
    .filter(Boolean)
  if (urls.length > 0) return urls[0]!
  const single = (r.image_url ?? '').trim()
  return single || null
}

/** 업로드 경로(`/uploads/…`)는 API 호스트를 붙여 표시 */
export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) return ''
  let t = url.trim()
  if (!t) return ''
  if (t.startsWith('//')) {
    t = `https:${t}`
  }
  if (t.startsWith('http://') || t.startsWith('https://')) return t
  if (t.startsWith('/')) return `${API_BASE_URL}${t}`
  // DB에 `uploads/brog/…` 처럼 선행 슬래시 없이 들어간 경우 — Vite origin으로 가지 않게 API 붙임
  if (t.startsWith('uploads/')) return `${API_BASE_URL}/${t}`
  return t
}

/**
 * 브라우저가 보내는 Referer 때문에 외부 CDN(언스플래시/imgix 등)이 이미지를 거절하는 경우가 있어,
 * 절대 URL(`http(s)://…`)은 `no-referrer` 로 요청한다. API 호스트의 `/uploads` 포함.
 */
export function imgReferrerPolicyForResolvedSrc(
  resolvedSrc: string | null | undefined,
): 'no-referrer' | undefined {
  const t = (resolvedSrc ?? '').trim()
  if (t.startsWith('http://') || t.startsWith('https://')) {
    return 'no-referrer'
  }
  return undefined
}
