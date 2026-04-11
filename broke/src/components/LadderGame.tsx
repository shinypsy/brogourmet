import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import type { SadariCandidate } from '../lib/buildSadariCandidates'
import { ladderColXs, ladderColumnPercentX } from '../lib/sadariLayout'
import {
  generateSadariRungs,
  randomLadderRowCount,
  traceSadari,
  type Rung,
} from '../lib/sadariLadder'

const PATH_DURATION_MS = 2800

function newLadderLayout(numLines: number): { numRows: number; rungs: Rung[] } {
  const numRows = randomLadderRowCount()
  return { numRows, rungs: generateSadariRungs(numLines, numRows) }
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** 0..n-1 무작위 순열 (하단 슬롯에 어떤 후보를 둘지) */
function shufflePermutation(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
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
  /** 1-based 깃발 번호(후보 배열 인덱스+1). 애니메이션 끝에 호출, 초기화 시 null */
  onWinnerPinRank?: (rank: number | null) => void
}

export function LadderGame({ candidates, onWinnerPinRank }: Props) {
  const n = candidates.length
  const xs = useMemo(() => ladderColXs(n), [n])

  const [layout, setLayout] = useState(() => newLadderLayout(n))
  const { numRows, rungs } = layout
  const [bottomPerm, setBottomPerm] = useState<number[]>(() => shufflePermutation(n))
  const [startCol, setStartCol] = useState<number | null>(null)
  const [showPath, setShowPath] = useState(false)
  const [resultCol, setResultCol] = useState<number | null>(null)

  const pathRef = useRef<SVGPolylineElement | null>(null)
  const pathWinnerNotifiedRef = useRef(false)
  const pathPoints = useMemo(() => {
    if (startCol == null) return null
    return buildPathPoints(numRows, rungs, startCol, xs)
  }, [numRows, rungs, startCol, xs])

  const pointsAttr = pathPoints?.map(([x, y]) => `${x},${y}`).join(' ') ?? ''

  const notifyClear = useCallback(() => {
    onWinnerPinRank?.(null)
  }, [onWinnerPinRank])

  const reshuffle = useCallback(() => {
    notifyClear()
    setLayout(newLadderLayout(n))
    setBottomPerm(shufflePermutation(n))
    setStartCol(null)
    setShowPath(false)
    setResultCol(null)
  }, [n, notifyClear])

  const pickColumn = useCallback(
    (i: number) => {
      notifyClear()
      setStartCol(i)
      setShowPath(false)
      setResultCol(null)
    },
    [notifyClear],
  )

  function runReveal() {
    if (startCol == null) return
    notifyClear()
    const end = traceSadari(numRows, rungs, startCol)
    setResultCol(end)
    setShowPath(true)
    if (prefersReducedMotion()) {
      const wIdx = bottomPerm[end]
      if (wIdx != null) onWinnerPinRank?.(wIdx + 1)
    }
  }

  useLayoutEffect(() => {
    const poly = pathRef.current
    if (!showPath || !poly || pathPoints == null || startCol == null) return

    if (prefersReducedMotion()) {
      poly.style.strokeDasharray = ''
      poly.style.strokeDashoffset = ''
      poly.style.transition = ''
      return
    }

    pathWinnerNotifiedRef.current = false
    const len = poly.getTotalLength()
    poly.style.transition = 'none'
    poly.style.strokeDasharray = `${len}`
    poly.style.strokeDashoffset = `${len}`

    const raf = window.requestAnimationFrame(() => {
      poly.style.transition = `stroke-dashoffset ${PATH_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
      poly.style.strokeDashoffset = '0'
    })

    const endCol = traceSadari(numRows, rungs, startCol)
    const onEnd = (e: TransitionEvent) => {
      if (e.propertyName !== 'stroke-dashoffset') return
      if (pathWinnerNotifiedRef.current) return
      pathWinnerNotifiedRef.current = true
      poly.removeEventListener('transitionend', onEnd)
      const wIdx = bottomPerm[endCol]
      if (wIdx != null) onWinnerPinRank?.(wIdx + 1)
    }
    poly.addEventListener('transitionend', onEnd)

    return () => {
      window.cancelAnimationFrame(raf)
      poly.removeEventListener('transitionend', onEnd)
    }
  }, [showPath, pathPoints, startCol, numRows, rungs, bottomPerm, onWinnerPinRank])

  const winnerIdx = resultCol != null ? bottomPerm[resultCol] : null
  const winner = winnerIdx != null ? candidates[winnerIdx] : null

  return (
    <section className="map-page-map-section map-card game-page__ladder-card">
      <h3 className="map-page-map-section__title">사다리 게임</h3>
      <p className="map-page-map-section__hint">
        위에서 <strong>번호</strong>를 고른 뒤 <strong>점메추천</strong>을 누르면 사다리가 따라 내려갑니다. 아래 이름을 누르면
        상세로 이동합니다.
      </p>

      <div className="ladder-game">
        <div className="ladder-game__toolbar">
          <button type="button" className="ghost-button ladder-game__shuffle" onClick={reshuffle}>
            사다리 다시 그리기
          </button>
        </div>

        <div className="ladder-game__chart">
          <div className="ladder-game__column-strip" role="group" aria-label="시작 번호 선택">
            {candidates.map((c, i) => {
              const xPct = ladderColumnPercentX(n, i)
              return (
                <button
                  key={c.key}
                  type="button"
                  className={
                    'ladder-game__pick-num-only' +
                    (startCol === i ? ' ladder-game__pick-num-only--active' : '') +
                    (showPath && startCol === i ? ' ladder-game__pick-num-only--running' : '')
                  }
                  style={{ left: `${xPct}%` }}
                  aria-label={`${i + 1}번에서 시작`}
                  aria-pressed={startCol === i}
                  onClick={() => pickColumn(i)}
                >
                  {i + 1}
                </button>
              )
            })}
          </div>

          <div className="ladder-game__svg-wrap">
            <svg
              className="ladder-game__svg"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden
            >
            {xs.map((x) => (
              <line key={x} x1={x} y1={7} x2={x} y2={93} className="ladder-game__vline" />
            ))}
            {rungs.map((r) => {
              const y = yAtRow(r.row, numRows)
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
                <polyline ref={pathRef} points={pointsAttr} className="ladder-game__path" fill="none" />
              ) : null}
            </svg>
          </div>

          <div className="ladder-game__column-strip ladder-game__column-strip--bottom">
            {bottomPerm.map((candidateIdx, col) => {
              const c = candidates[candidateIdx]
              const xPct = ladderColumnPercentX(n, col)
              return (
                <Link
                  key={`b-col-${col}-${candidateIdx}`}
                  to={c.href}
                  className={
                    'ladder-game__slot ladder-game__slot--link' +
                    (showPath && resultCol === col ? ' ladder-game__slot--hit' : '')
                  }
                  style={{ left: `${xPct}%` }}
                >
                  <span className="ladder-game__slot-label">{c.label}</span>
                </Link>
              )
            })}
          </div>
        </div>

        <div className="ladder-game__actions">
          <button
            type="button"
            className="primary-link ladder-game__cta"
            disabled={startCol == null}
            onClick={runReveal}
          >
            점메추천
          </button>
        </div>

        {winner && showPath ? (
          <p className="ladder-game__result" role="status" aria-live="polite">
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
    </section>
  )
}
