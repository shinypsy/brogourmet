import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { Key, PointerEvent as ReactPointerEvent, ReactNode } from 'react'

export const BROG_RANK_GRID_PAGE_SIZE = 8
const SWIPE_PX = 50
const CLICK_BLOCK_PX = 12
/** 터치: 수직 스크롤과 구분·가로 스와이프 판정 (px) */
const TOUCH_AXIS_PX = 12

function chunkItems<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export type BrogRankGridCarouselProps<T> = {
  items: T[]
  pageSize?: number
  /** 필터 등이 바뀌면 1페이지로 리셋 */
  resetKey: string | number | boolean
  getItemKey: (item: T) => Key
  /** 한 페이지(기본 8개)를 통째로 그릴 때(예: MyG 이미지 그리드). 있으면 `renderItem`은 쓰지 않음 */
  renderPage?: (page: T[], startGlobalRankOneBased: number) => ReactNode
  renderItem?: (item: T, globalRank: number) => ReactNode
  ariaLabel: string
  onPaginationInfo?: (info: { pageIndex: number; pageCount: number }) => void
  /** « » 접근성 문구 단위. 기본 `곳`(BroG) */
  carouselStepAriaUnit?: string
}

export function BrogRankGridCarousel<T>(props: BrogRankGridCarouselProps<T>) {
  const {
    items,
    pageSize = BROG_RANK_GRID_PAGE_SIZE,
    resetKey,
    getItemKey,
    renderPage,
    renderItem,
    ariaLabel,
    onPaginationInfo,
    carouselStepAriaUnit = '곳',
  } = props

  if (!renderPage && !renderItem) {
    throw new Error('BrogRankGridCarousel: renderItem 또는 renderPage 중 하나는 필요합니다.')
  }

  const pages = useMemo(() => chunkItems(items, pageSize), [items, pageSize])
  const listPageCount = pages.length

  const [listPageIndex, setListPageIndex] = useState(0)
  const listPageIndexRef = useRef(0)
  listPageIndexRef.current = listPageIndex

  const safePageIndex = useMemo(
    () => Math.min(listPageIndex, Math.max(0, listPageCount - 1)),
    [listPageIndex, listPageCount],
  )
  const carouselViewportRef = useRef<HTMLDivElement>(null)
  const [carouselWidth, setCarouselWidth] = useState(0)
  const [carouselPullPx, setCarouselPullPx] = useState(0)
  const [carouselDragging, setCarouselDragging] = useState(false)
  const carouselDragRef = useRef<{
    pointerId: number | null
    startX: number
    pulling: boolean
    /** 수평 드래그로 판단된 뒤에만 캡처 — 탭 시 링크·버튼 클린이 포인터 캡처에 먹히지 않게 */
    captureActive: boolean
  }>({ pointerId: null, startX: 0, pulling: false, captureActive: false })
  const blockCarouselClickRef = useRef(false)
  const onPaginationInfoRef = useRef(onPaginationInfo)
  onPaginationInfoRef.current = onPaginationInfo

  useEffect(() => {
    setListPageIndex(0)
  }, [resetKey])

  /* 페이지 수 감소(예: 9건→8건·필터) 직후에도 첫 페인트부터 인덱스가 범위 안에 있게 */
  useLayoutEffect(() => {
    setListPageIndex((i) => Math.min(i, Math.max(0, listPageCount - 1)))
  }, [listPageCount])

  useLayoutEffect(() => {
    const el = carouselViewportRef.current
    if (!el) return
    const bump = () => {
      const cw = Math.round(el.getBoundingClientRect().width)
      if (cw > 0) setCarouselWidth(cw)
    }
    const ro = new ResizeObserver(bump)
    ro.observe(el)
    bump()
    /* 첫 프레임에 부모 flex·그리드 레이아웃이 아직 0px인 경우 한 틱 뒤 재측정(1번 슬라이드 과대 방지) */
    const raf = requestAnimationFrame(bump)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [items.length, listPageCount])

  useEffect(() => {
    onPaginationInfoRef.current?.({ pageIndex: safePageIndex, pageCount: listPageCount })
  }, [safePageIndex, listPageCount])

  /* 폰 등: Pointer + 지연 캡처만으로는 touchmove가 안 오는 경우가 있어 touch 전용 스와이프 */
  useEffect(() => {
    const el = carouselViewportRef.current
    if (!el || listPageCount <= 1) return

    let startX = 0
    let startY = 0
    let active = false
    let pulling = false
    let discard = false

    const resetVisual = () => {
      setCarouselPullPx(0)
      setCarouselDragging(false)
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      const target = e.target as HTMLElement
      // 카드 전체가 <Link>(a)로 감싸져 있음 — a 를 제외해야 폰에서 스와이프 시작 가능. 탭은 touchend·클릭 차단으로 구분.
      if (target.closest('button, input, select, textarea, [data-carousel-no-drag]')) return
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      active = true
      pulling = false
      discard = false
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!active || e.touches.length !== 1) return
      const x = e.touches[0].clientX
      const y = e.touches[0].clientY
      const dx = x - startX
      const dy = y - startY

      if (!pulling && !discard) {
        if (Math.abs(dy) > TOUCH_AXIS_PX && Math.abs(dy) >= Math.abs(dx)) {
          discard = true
          return
        }
        if (Math.abs(dx) > TOUCH_AXIS_PX && Math.abs(dx) > Math.abs(dy) + 2) {
          pulling = true
          setCarouselDragging(true)
          e.preventDefault()
        } else {
          return
        }
      }

      if (discard) return

      if (pulling) {
        e.preventDefault()
        const ei = Math.min(listPageIndexRef.current, Math.max(0, listPageCount - 1))
        let pull = dx
        if (ei <= 0) pull = Math.min(0, pull)
        if (ei >= listPageCount - 1) pull = Math.max(0, pull)
        setCarouselPullPx(pull)
      }
    }

    const endTouchSwipe = (e: TouchEvent) => {
      if (!active) return
      const t = e.changedTouches[0]
      const dx = t ? t.clientX - startX : 0
      const wasPulling = pulling
      active = false
      pulling = false
      discard = false
      resetVisual()

      if (wasPulling && Math.abs(dx) > CLICK_BLOCK_PX) {
        blockCarouselClickRef.current = true
        window.setTimeout(() => {
          blockCarouselClickRef.current = false
        }, 320)
      }

      if (wasPulling) {
        setListPageIndex((i) => {
          const ei = Math.min(i, Math.max(0, listPageCount - 1))
          if (dx < -SWIPE_PX && ei < listPageCount - 1) return ei + 1
          if (dx > SWIPE_PX && ei > 0) return ei - 1
          return ei
        })
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true, capture: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false, capture: true })
    el.addEventListener('touchend', endTouchSwipe, { passive: true, capture: true })
    el.addEventListener('touchcancel', endTouchSwipe, { passive: true, capture: true })

    return () => {
      el.removeEventListener('touchstart', onTouchStart, { capture: true })
      el.removeEventListener('touchmove', onTouchMove, { capture: true })
      el.removeEventListener('touchend', endTouchSwipe, { capture: true })
      el.removeEventListener('touchcancel', endTouchSwipe, { capture: true })
    }
  }, [listPageCount, items.length])

  const endCarouselDrag = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>, opts: { cancelOnly?: boolean; skipRelease?: boolean } = {}) => {
      const d = carouselDragRef.current
      if (d.pointerId !== e.pointerId) return
      const hadCapture = d.captureActive
      if (!opts.skipRelease && hadCapture) {
        try {
          ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
        } catch {
          /* */
        }
      }
      const dx = e.clientX - d.startX
      const wasPulling = d.pulling
      carouselDragRef.current = {
        pointerId: null,
        startX: 0,
        pulling: false,
        captureActive: false,
      }
      setCarouselPullPx(0)
      setCarouselDragging(false)

      if (wasPulling && Math.abs(dx) > CLICK_BLOCK_PX) {
        blockCarouselClickRef.current = true
        window.setTimeout(() => {
          blockCarouselClickRef.current = false
        }, 320)
      }

      if (opts.cancelOnly) return

      if (wasPulling) {
        setListPageIndex((i) => {
          const ei = Math.min(i, Math.max(0, listPageCount - 1))
          if (dx < -SWIPE_PX && ei < listPageCount - 1) return ei + 1
          if (dx > SWIPE_PX && ei > 0) return ei - 1
          return ei
        })
      }
    },
    [listPageCount],
  )

  const onCarouselPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const t = e.target as HTMLElement
    if (t.closest('button, input, select, textarea, [data-carousel-no-drag]')) return

    carouselDragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      pulling: false,
      captureActive: false,
    }
  }, [])

  const onCarouselPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'touch') return
      const d = carouselDragRef.current
      if (d.pointerId !== e.pointerId) return
      const dx = e.clientX - d.startX
      if (!d.captureActive) {
        if (Math.abs(dx) <= 8) return
        d.captureActive = true
        d.pulling = true
        setCarouselDragging(true)
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          /* */
        }
      }
      if (d.pulling) {
        let pull = dx
        const ei = Math.min(listPageIndexRef.current, Math.max(0, listPageCount - 1))
        if (ei <= 0) pull = Math.min(0, pull)
        if (ei >= listPageCount - 1) pull = Math.max(0, pull)
        setCarouselPullPx(pull)
      }
    },
    [listPageCount],
  )

  const onCarouselPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'touch') return
      endCarouselDrag(e)
    },
    [endCarouselDrag],
  )

  const onCarouselPointerCancel = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'touch') return
      endCarouselDrag(e, { cancelOnly: true })
    },
    [endCarouselDrag],
  )

  const onCarouselLostPointerCapture = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'touch') return
      if (carouselDragRef.current.pointerId === e.pointerId) {
        endCarouselDrag(e, { cancelOnly: true, skipRelease: true })
      }
    },
    [endCarouselDrag],
  )

  const onCarouselClickCapture = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (blockCarouselClickRef.current) {
      e.preventDefault()
      e.stopPropagation()
    }
  }, [])

  if (items.length === 0) return null

  const w = carouselWidth > 0 ? carouselWidth : 0
  const trackTranslate = listPageCount > 0 && w > 0 ? -(safePageIndex * w) + carouselPullPx : 0
  const trackWidthPx = listPageCount > 0 && w > 0 ? listPageCount * w : undefined

  /* 1페이지만 있을 때 « »를 숨기면 뷰포트가 가로로 넓어져 모바일 2열 썸네일이 과대해짐 — 화살표와 동일 폭 스페이서 유지 */
  const prevSlot =
    listPageCount > 1 ? (
      <button
        type="button"
        className="brog-list-carousel__arrow"
        aria-label={`이전 ${pageSize}${carouselStepAriaUnit}`}
        disabled={safePageIndex <= 0}
        onClick={() => setListPageIndex((i) => Math.max(0, i - 1))}
      >
        «
      </button>
    ) : (
      <div className="brog-list-carousel__arrow-spacer" aria-hidden />
    )

  const nextSlot =
    listPageCount > 1 ? (
      <button
        type="button"
        className="brog-list-carousel__arrow"
        aria-label={`다음 ${pageSize}${carouselStepAriaUnit}`}
        disabled={safePageIndex >= listPageCount - 1}
        onClick={() => setListPageIndex((i) => Math.min(listPageCount - 1, i + 1))}
      >
        »
      </button>
    ) : (
      <div className="brog-list-carousel__arrow-spacer" aria-hidden />
    )

  return (
    <div className="brog-list-carousel" role="region" aria-roledescription="carousel" aria-label={ariaLabel}>
      {prevSlot}
      <div
        className={`brog-list-carousel__viewport${carouselDragging ? ' brog-list-carousel--dragging' : ''}`}
        ref={carouselViewportRef}
        onPointerDown={onCarouselPointerDown}
        onPointerMove={onCarouselPointerMove}
        onPointerUp={onCarouselPointerUp}
        onPointerCancel={onCarouselPointerCancel}
        onLostPointerCapture={onCarouselLostPointerCapture}
        onClickCapture={onCarouselClickCapture}
      >
        <div
          className="brog-list-carousel__track"
          style={{
            width: trackWidthPx,
            transform: `translate3d(${trackTranslate}px, 0, 0)`,
            transition: carouselDragging ? 'none' : 'transform 0.32s ease',
          }}
        >
          {pages.map((page, pi) => (
            <div
              key={pi}
              className="brog-list-carousel__page"
              style={
                w > 0
                  ? { width: w, flexShrink: 0 }
                  : {
                      flex: '0 0 100%',
                      width: '100%',
                      maxWidth: '100%',
                      minWidth: 0,
                    }
              }
              aria-hidden={pi !== safePageIndex}
            >
              {renderPage ? (
                renderPage(page, pi * pageSize + 1)
              ) : (
                <ul className="brog-rank-grid brog-rank-grid--paged">
                  {page.map((item, li) => {
                    const globalRank = pi * pageSize + li + 1
                    return (
                      <li key={getItemKey(item)}>{renderItem!(item, globalRank)}</li>
                    )
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
      {nextSlot}
    </div>
  )
}
