/**
 * 지도 깃발 색 구분
 * - `franchise`: 가맹점 — 빨강
 * - `brog`: BroG 등록 일반 점포 — 파랑
 * - `myg`: MyG 제보 — 노랑
 * - `freeShare`: 무료나눔 — 녹색
 */
export type BrogMapMarkerKind = 'franchise' | 'brog' | 'myg' | 'freeShare'

const MARKER_STYLES: Record<BrogMapMarkerKind, { fill: string; stroke: string; sheen: string }> = {
  franchise: {
    fill: '#d32f2f',
    stroke: '#7f1a1a',
    sheen: '#ffcdd2',
  },
  brog: {
    fill: '#2e7dd4',
    stroke: '#174a82',
    sheen: '#b3d4ff',
  },
  myg: {
    fill: '#e6b422',
    stroke: '#9a7209',
    sheen: '#fff4c4',
  },
  freeShare: {
    fill: '#2e9d6c',
    stroke: '#145a3c',
    sheen: '#b8f0d4',
  },
}

function flagSvgBody(kind: BrogMapMarkerKind): string {
  const { fill, stroke, sheen } = MARKER_STYLES[kind]
  return `
    <ellipse cx="20" cy="44" rx="5" ry="3" fill="rgba(0,0,0,.18)"/>
    <rect x="17" y="10" width="3.5" height="34" rx="1" fill="#2a3142"/>
    <path d="M20.5 10 L38 19 L20.5 28 Z" fill="${fill}" stroke="${stroke}" stroke-width="1"/>
    <path d="M20.5 12 L35 19 L20.5 26 Z" fill="${sheen}" opacity=".45"/>
`
}

function encodeSvg(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/** 깃발만 (숫자 없음) */
export function defaultBrogFlagMarkerUrl(kind: BrogMapMarkerKind = 'brog'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 48" width="40" height="48">${flagSvgBody(kind)}</svg>`
  return encodeSvg(svg)
}

/**
 * 삼각 깃발 안에 순번 표시 (사다리·목록 순서와 맞춤)
 * @param rank 1-based
 */
export function rankedBrogFlagMarkerUrl(rank: number, kind: BrogMapMarkerKind = 'brog'): string {
  const n = Math.max(1, Math.min(999, Math.floor(rank)))
  const text = String(n)
  const fontSize = text.length >= 3 ? 9 : text.length === 2 ? 11 : 13
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 48" width="40" height="48">${flagSvgBody(
    kind,
  )}<text x="29" y="20" text-anchor="middle" dominant-baseline="central" fill="#1a1f2e" font-family="system-ui,-apple-system,sans-serif" font-weight="800" font-size="${fontSize}">${text}</text></svg>`
  return encodeSvg(svg)
}
