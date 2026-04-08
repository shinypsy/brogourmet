import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import type { SadariCandidate } from '../lib/buildSadariCandidates'
import { generateSadariRungs, traceSadari, type Rung } from '../lib/sadariLadder'

const NUM_ROWS = 22

/** 0..n-1 무작위 순열 (하단 슬롯에 어떤 후보를 둘지) */
function shufflePermutation(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function colXs(numLines: number): number[] {
  const left = 7
  const right = 93
  if (numLines <= 1) return [50]
  const step = (right - left) / (numLines - 1)
  return Array.from({ length: numLines }, (_, i) => left + i * step)
}

function yAtRow(row: number, numRows: number): number {
  const topY = 7
  const bottomY = 93
  return topY + ((row + 1) / (numRows + 1)) * (bottomY - topY)
}

function buildPathPoints(
  numRows: number,
  rungs: Rung[],
  startCol: number,
  xs: number[],
): [number, number][] {
  let col = startCol
  const topY = 7
  const bottomY = 93
  const pts: [number, number][] = [[xs[col], topY]]

  const byRow = new Map<number, Rung[]>()
  for (const r of rungs) {
    const arr = byRow.get(r.row) ?? []
    arr.push(r)
    byRow.set(r.row, arr)
  }

  for (let row = 0; row < numRows; row += 1) {
    const y = yAtRow(row, numRows)
    pts.push([xs[col], y])
    const at = (byRow.get(row) ?? []).slice().sort((a, b) => a.leftCol - b.leftCol)
    for (const { leftCol } of at) {
      if (leftCol === col) {
        col += 1
        pts.push([xs[col], y])
      } else if (leftCol === col - 1) {
        col -= 1
        pts.push([xs[col], y])
      }
    }
  }
  pts.push([xs[col], bottomY])
  return pts
}

type Props = {
  candidates: SadariCandidate[]
}

export function LadderGame({ candidates }: Props) {
  const n = candidates.length
  const xs = useMemo(() => colXs(n), [n])

  const [rungs, setRungs] = useState<Rung[]>(() => generateSadariRungs(n, NUM_ROWS))
  const [bottomPerm, setBottomPerm] = useState<number[]>(() => shufflePermutation(n))
  const [startCol, setStartCol] = useState<number | null>(null)
  const [showPath, setShowPath] = useState(false)
  const [resultCol, setResultCol] = useState<number | null>(null)

  const reshuffle = useCallback(() => {
    setRungs(generateSadariRungs(n, NUM_ROWS))
    setBottomPerm(shufflePermutation(n))
    setStartCol(null)
    setShowPath(false)
    setResultCol(null)
  }, [n])

  const pathPoints = useMemo(() => {
    if (startCol == null) return null
    return buildPathPoints(NUM_ROWS, rungs, startCol, xs)
  }, [rungs, startCol, xs])

  const pointsAttr = pathPoints?.map(([x, y]) => `${x},${y}`).join(' ') ?? ''

  function runReveal() {
    if (startCol == null) return
    const end = traceSadari(NUM_ROWS, rungs, startCol)
    setResultCol(end)
    setShowPath(true)
  }

  const winnerIdx = resultCol != null ? bottomPerm[resultCol] : null
  const winner = winnerIdx != null ? candidates[winnerIdx] : null

  return (
    <div className="ladder-game">
      <div className="ladder-game__toolbar">
        <button type="button" className="ghost-button ladder-game__shuffle" onClick={reshuffle}>
          사다리 다시 그리기
        </button>
      </div>

      <div className="ladder-game__labels ladder-game__labels--top">
        {candidates.map((c, i) => (
          <button
            key={c.key}
            type="button"
            className={
              'ladder-game__pick' +
              (startCol === i ? ' ladder-game__pick--active' : '') +
              (showPath && startCol === i ? ' ladder-game__pick--running' : '')
            }
            onClick={() => {
              setStartCol(i)
              setShowPath(false)
              setResultCol(null)
            }}
          >
            <span className="ladder-game__pick-num">{i + 1}</span>
            <span className="ladder-game__pick-label">{c.label}</span>
            <span className="ladder-game__pick-src">{c.source === 'myg' ? 'MyG' : 'BroG'}</span>
          </button>
        ))}
      </div>

      <div className="ladder-game__svg-wrap">
        <svg
          className="ladder-game__svg"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          {xs.map((x) => (
            <line
              key={x}
              x1={x}
              y1={7}
              x2={x}
              y2={93}
              className="ladder-game__vline"
            />
          ))}
          {rungs.map((r) => {
            const y = yAtRow(r.row, NUM_ROWS)
            const x0 = xs[r.leftCol]
            const x1 = xs[r.leftCol + 1]
            return (
              <line
                key={`${r.row}-${r.leftCol}`}
                x1={x0}
                y1={y}
                x2={x1}
                y2={y}
                className="ladder-game__rung"
              />
            )
          })}
          {showPath && pathPoints ? (
            <polyline points={pointsAttr} className="ladder-game__path" fill="none" />
          ) : null}
        </svg>
      </div>

      <div className="ladder-game__labels ladder-game__labels--bottom" aria-hidden>
        {bottomPerm.map((candidateIdx, col) => {
          const c = candidates[candidateIdx]
          return (
            <div
              key={`b-col-${col}-${candidateIdx}`}
              className={
                'ladder-game__slot' + (showPath && resultCol === col ? ' ladder-game__slot--hit' : '')
              }
            >
              <span className="ladder-game__slot-label">{c.label}</span>
            </div>
          )
        })}
      </div>

      <div className="ladder-game__actions">
        <button
          type="button"
          className="primary-link"
          disabled={startCol == null}
          onClick={runReveal}
        >
          점메 추첨!
        </button>
      </div>

      {winner && showPath ? (
        <p className="ladder-game__result">
          오늘의 점심 후보:{' '}
          <Link to={winner.href} className="ladder-game__result-link">
            {winner.label}
          </Link>
          <span className="ladder-game__result-meta">
            {' '}
            ({winner.source === 'myg' ? 'MyG' : 'BroG'} · 약 {winner.distanceM}m)
          </span>
        </p>
      ) : null}
    </div>
  )
}
