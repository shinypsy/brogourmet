export type Rung = { row: number; leftCol: number }

/** 인접한 가로줄이 같은 행에서 맞닿지 않도록 사다리 가로발을 만듭니다. */
export function generateSadariRungs(numLines: number, numRows: number): Rung[] {
  const rungs: Rung[] = []
  for (let row = 0; row < numRows; row += 1) {
    const gaps = Array.from({ length: numLines - 1 }, (_, i) => i)
    gaps.sort(() => Math.random() - 0.5)
    const chosen = new Set<number>()
    for (const g of gaps) {
      if (Math.random() > 0.4) continue
      if (chosen.has(g - 1) || chosen.has(g + 1)) continue
      chosen.add(g)
      rungs.push({ row, leftCol: g })
    }
  }
  return rungs
}

/** 맨 위 startCol에서 시작해 맨 아래 도착 열 인덱스(0..numLines-1). */
export function traceSadari(numRows: number, rungs: Rung[], startCol: number): number {
  let col = startCol
  const byRow = new Map<number, Rung[]>()
  for (const r of rungs) {
    const arr = byRow.get(r.row) ?? []
    arr.push(r)
    byRow.set(r.row, arr)
  }
  for (let row = 0; row < numRows; row += 1) {
    const at = (byRow.get(row) ?? []).slice().sort((a, b) => a.leftCol - b.leftCol)
    for (const { leftCol } of at) {
      if (leftCol === col) col += 1
      else if (leftCol === col - 1) col -= 1
    }
  }
  return col
}
