import { API_BASE_URL } from '../api/config'

/** 업로드 경로(`/uploads/…`)는 API 호스트를 붙여 표시 */
export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) return ''
  const t = url.trim()
  if (!t) return ''
  if (t.startsWith('/')) return `${API_BASE_URL}${t}`
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
