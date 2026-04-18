/** `#RRGGBB` / `#RGB` → `rgba(r,g,b,a)` (카드 그라데이션 등) */
export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '').trim()
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  if (full.length !== 6) return `rgba(74,85,104,${alpha})`
  const n = parseInt(full, 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r},${g},${b},${alpha})`
}
