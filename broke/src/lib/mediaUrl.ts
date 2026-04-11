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

function parseApiBase(): URL | null {
  try {
    return new URL(API_BASE_URL)
  } catch {
    return null
  }
}

/**
 * 업로드 경로(`/uploads/…`)는 API 호스트 기준으로 표시.
 * DB에 `http://localhost:8000/uploads/...` 처럼 저장돼 있고 실제 API는 `:8001`인 경우 등 호스트/포트 불일치를 맞춤.
 */
export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) return ''
  let t = url.trim()
  if (!t) return ''
  if (t.startsWith('//')) {
    t = `https:${t}`
  }
  if (t.startsWith('http://') || t.startsWith('https://')) {
    try {
      const u = new URL(t)
      if (!u.pathname.startsWith('/uploads')) return t
      const apiBase = parseApiBase()
      if (!apiBase) return t
      const loopback =
        u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]'
      if (loopback || u.hostname === apiBase.hostname) {
        return `${apiBase.origin}${u.pathname}${u.search}${u.hash}`
      }
    } catch {
      /* ignore */
    }
    return t
  }
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
