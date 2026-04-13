/**
 * 무료나눔 리스트 「나눔장소」 셀: 장소명은 그대로, 주소형 문자열이면 ○○동 11-12 형태로 축약.
 */
export function formatFreeShareListPlace(post: {
  share_place_label?: string | null
  district?: string | null
}): string {
  const label = post.share_place_label?.trim()
  const district = post.district?.trim()
  const raw = label || district || ''
  if (!raw) return '—'

  // "… 동교동 11-2" / "동교동 11-2" (공백 구분)
  const spaced = raw.match(/(\S+동)\s+(\d+(?:-\d+)?)\b/)
  if (spaced) return `${spaced[1]} ${spaced[2]}`

  // "동교동11-2" (붙어 있음)
  const tight = raw.match(/(\S+동)(\d+(?:-\d+)?)\b/)
  if (tight) return `${tight[1]} ${tight[2]}`

  return raw
}

export function formatFreeShareListDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${y}.${m}.${day}.`
}
