export const FREE_SHARE_MAX_IMAGES = 6

/** 중복 제거·최대 6장·URL 길이 상한. */
export function normalizeFreeShareImageUrls(parts: readonly (string | null | undefined)[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const x of parts) {
    const t = String(x ?? '').trim().slice(0, 500)
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
    if (out.length >= FREE_SHARE_MAX_IMAGES) break
  }
  return out
}

/** 폼 UI: 비어 있으면 빈 한 줄만. 있으면 URL마다 한 줄(「링크 추가」로 빈 줄을 더해 최대 6줄). */
export function freeShareUrlFormRows(urls: readonly (string | null | undefined)[]): string[] {
  const n = normalizeFreeShareImageUrls(urls)
  if (n.length === 0) return ['']
  return [...n]
}
