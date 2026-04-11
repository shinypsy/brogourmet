/** 사다리 SVG viewBox(0–100) 안 세로줄 x — 상·하단 숫자/슬롯과 동일 % 정렬 */
export function ladderColXs(numLines: number): number[] {
  if (numLines <= 1) return [50]
  return Array.from({ length: numLines }, (_, i) => 7 + (i / (numLines - 1)) * 86)
}

export function ladderColumnPercentX(numLines: number, i: number): number {
  return ladderColXs(numLines)[i] ?? 50
}
