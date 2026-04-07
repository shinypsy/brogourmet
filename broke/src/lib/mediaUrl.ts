import { API_BASE_URL } from '../api/config'

/** 업로드 경로(`/uploads/…`)는 API 호스트를 붙여 표시 */
export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) return ''
  const t = url.trim()
  if (!t) return ''
  if (t.startsWith('/')) return `${API_BASE_URL}${t}`
  return t
}
