import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { KAKAO_MAP_APP_KEY } from '../api/config'
import {
  defaultBrogFlagMarkerUrl,
  rankedBrogFlagMarkerUrl,
  type BrogMapMarkerKind,
} from '../lib/brogMapFlagMarker'
import { ensureKakaoMapsReady } from '../lib/kakaoMapsSdk'

const SEOUL_DEFAULT = { lat: 37.5665, lng: 126.978 }

export type BrogKakaoMapPin = {
  id: number
  title: string
  latitude: number
  longitude: number
  /** 1-based 순번. 있으면 깃발에 숫자 표시 (목록·사다리 열 순서와 맞춤) */
  rank?: number
  /** 있으면 클릭 시 이 경로로 이동 (`getDetailPath` 대신) */
  href?: string
  /** `franchise` 빨강 · `brog` 파랑(BroG) · `myg` 노랑(MyG) · `freeShare` 녹색(무료나눔). 기본 `brog`. */
  markerKind?: BrogMapMarkerKind
  /** `mapSpeechBubbles`일 때 깃발 옆 말풍선에 표시할 상호 */
  mapSpeechLabel?: string
}

type KakaoLatLngLike = {
  getLat: () => number
  getLng: () => number
}

type KakaoMapInstance = {
  setCenter: (latlng: unknown) => void
  setBounds: (bounds: unknown) => void
  setLevel?: (level: number) => void
  /** 카카오맵: 숫자가 클수록 더 넓게(줌 아웃), 1에 가깝게 확대 */
  getLevel?: () => number
  relayout?: () => void
  getCenter?: () => KakaoLatLngLike
  getProjection?: () => {
    coordsFromContainerPoint: (point: unknown) => KakaoLatLngLike | null | undefined
  } | null
}

type KakaoMarkerInstance = {
  setMap: (map: KakaoMapInstance | null) => void
}

type KakaoCustomOverlayInstance = {
  setMap: (map: KakaoMapInstance | null) => void
}

type KakaoMapsNs = {
  event?: {
    addListener: (target: unknown, type: string, handler: (e?: unknown) => void) => unknown
    removeListener?: (listener: unknown) => void
  }
  LatLng: new (lat: number, lng: number) => unknown
  LatLngBounds: new () => { extend: (latlng: unknown) => void }
  Map: new (container: HTMLElement, options: Record<string, unknown>) => KakaoMapInstance
  Marker: new (options: Record<string, unknown>) => KakaoMarkerInstance
  MarkerImage: new (src: string, size: unknown, options?: { offset?: unknown }) => unknown
  CustomOverlay: new (options: Record<string, unknown>) => KakaoCustomOverlayInstance
  Size: new (width: number, height: number) => unknown
  Point: new (x: number, y: number) => unknown
}

function getKakaoMaps(): KakaoMapsNs | undefined {
  return (window as unknown as { kakao?: { maps: KakaoMapsNs } }).kakao?.maps
}

export type BrogKakaoMapProps = {
  userCoords: { lat: number; lng: number } | null
  pins: BrogKakaoMapPin[]
  locating: boolean
  onMyLocationClick: () => void
  /**
   * 지도를 약 0.55초 이상 누르거나(터치·왼쪽 클릭), 마우스 우클릭 시 그 지점을 내 위치로 쓸 때.
   * (지도 컨테이너에서 `contextmenu` 기본 메뉴는 막습니다.)
   */
  onPickUserLocationOnMap?: (lat: number, lng: number) => void
  /** 있으면 우클릭·롱프레스 안내 문구를 이 내용으로 대체 */
  pickLocationHint?: ReactNode
  /**
   * 지도 우클릭·롱프레스로 `onPickUserLocationOnMap` 이 호출된 직후, 클릭 지점에 잠깐 말풍선으로 표시할 문구.
   */
  pickLocationRightClickBubbleText?: string
  /**
   * 드래그·줌 등으로 지도가 안정된 뒤(디바운스) 현재 화면 중심 좌표.
   * 목록 API의 near 기준으로 쓰기 좋음. 프로그램적 setBounds/setCenter 직후 잠깐은 호출되지 않습니다.
   */
  onMapViewSettled?: (lat: number, lng: number) => void
  /** `onMapViewSettled` 디바운스(ms). 기본 450. */
  mapViewSettleDebounceMs?: number
  /**
   * true(기본): 내 위치·깃발이 바뀔 때마다 setBounds로 맞춤.
   * false: 내 위치 좌표가 바뀔 때만 맞춤 — 목록만 갱신돼 깃발이 바뀌어도 사용자가 옮긴 지도 뷰를 유지.
   */
  autoRefitWhenPinsChange?: boolean
  /** 마커 클릭 시 이동할 경로 */
  getDetailPath: (id: number) => string
  /** 1-based 당첨 순번 — 말풍선에 「축 당첨!」표시(점메추 등) */
  winnerPinRank?: number | null
  /** true면 `mapSpeechLabel`이 있는 핀에 말풍선 표시 */
  mapSpeechBubbles?: boolean
  mapAriaLabel: string
  shellClassName?: string
  shellPlaceholderClassName?: string
  canvasClassName?: string
  errorClassName?: string
  /**
   * 값이 바뀔 때마다 지도 `relayout` (사다리 등 주변 레이아웃 변화 후 타일·크기 맞춤).
   * 점메추 페이지 등에서 전달.
   */
  mapRelayoutKey?: string
  /**
   * false: 지도 아래 롱프레스·뷰 안내, 깃발 범례 숨김. 홈 등 안내 유지 시 true(기본).
   */
  showInteractionHints?: boolean
}

const DEFAULT_SHELL = 'home-hub__map-shell'
const DEFAULT_SHELL_PLACEHOLDER = 'home-hub__map-shell home-hub__map-shell--placeholder'
const DEFAULT_CANVAS = 'home-hub__map-canvas'
const DEFAULT_ERROR = 'home-hub__map-error'

const LONG_PRESS_MS = 550
const LONG_PRESS_MOVE_PX = 14
const PROGRAMMATIC_MAP_MOVE_GUARD_MS = 750

export function BrogKakaoMap({
  userCoords,
  pins,
  locating,
  onMyLocationClick,
  onPickUserLocationOnMap,
  pickLocationHint,
  pickLocationRightClickBubbleText,
  onMapViewSettled,
  mapViewSettleDebounceMs = 450,
  autoRefitWhenPinsChange = true,
  getDetailPath,
  winnerPinRank = null,
  mapSpeechBubbles = false,
  mapAriaLabel,
  shellClassName = DEFAULT_SHELL,
  shellPlaceholderClassName = DEFAULT_SHELL_PLACEHOLDER,
  canvasClassName = DEFAULT_CANVAS,
  errorClassName = DEFAULT_ERROR,
  mapRelayoutKey = '',
  showInteractionHints = true,
}: BrogKakaoMapProps) {
  const navigate = useNavigate()
  const getDetailPathRef = useRef(getDetailPath)
  useLayoutEffect(() => {
    getDetailPathRef.current = getDetailPath
  }, [getDetailPath])
  const [mapSdkReady, setMapSdkReady] = useState(false)
  const [mapLoadError, setMapLoadError] = useState('')
  const mapRef = useRef<KakaoMapInstance | null>(null)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const markersRef = useRef<KakaoMarkerInstance[]>([])
  const overlaysRef = useRef<KakaoCustomOverlayInstance[]>([])
  const userMarkerRef = useRef<KakaoMarkerInstance | null>(null)
  const onPickUserLocationRef = useRef(onPickUserLocationOnMap)
  useLayoutEffect(() => {
    onPickUserLocationRef.current = onPickUserLocationOnMap
  }, [onPickUserLocationOnMap])

  const pickLocationRightClickBubbleTextRef = useRef<string | undefined>(undefined)
  useLayoutEffect(() => {
    const t = pickLocationRightClickBubbleText?.trim()
    pickLocationRightClickBubbleTextRef.current = t || undefined
  }, [pickLocationRightClickBubbleText])

  const mapPickBubbleOverlayRef = useRef<KakaoCustomOverlayInstance | null>(null)
  const pickBubbleHideTimerRef = useRef<number | null>(null)

  const onMapViewSettledRef = useRef(onMapViewSettled)
  useLayoutEffect(() => {
    onMapViewSettledRef.current = onMapViewSettled
  }, [onMapViewSettled])

  const ignoreExploreUntilRef = useRef(0)
  const prevUserAnchorKeyRef = useRef<string | null>(null)
  const prevPinsCountRef = useRef(-1)
  const prevPinsKeyRef = useRef('')
  const hasDoneInitialFitRef = useRef(false)

  useEffect(() => {
    if (!KAKAO_MAP_APP_KEY) return
    let cancelled = false
    ensureKakaoMapsReady(KAKAO_MAP_APP_KEY)
      .then(() => {
        if (!cancelled) {
          setMapSdkReady(true)
          setMapLoadError('')
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setMapSdkReady(false)
          setMapLoadError(err instanceof Error ? err.message : '지도를 불러오지 못했습니다.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useLayoutEffect(() => {
    const maps = getKakaoMaps()
    if (!mapSdkReady || !maps) return
    const container = mapContainerRef.current
    if (!container || mapRef.current) return
    mapRef.current = new maps.Map(container, {
      center: new maps.LatLng(SEOUL_DEFAULT.lat, SEOUL_DEFAULT.lng),
      level: 7,
    })
    const map = mapRef.current
    const ro = new ResizeObserver(() => map.relayout?.())
    ro.observe(container)
    window.requestAnimationFrame(() => map.relayout?.())

    return () => {
      ro.disconnect()
      markersRef.current.forEach((m) => m.setMap(null))
      markersRef.current = []
      overlaysRef.current.forEach((o) => o.setMap(null))
      overlaysRef.current = []
      userMarkerRef.current?.setMap(null)
      userMarkerRef.current = null
      if (pickBubbleHideTimerRef.current != null) {
        window.clearTimeout(pickBubbleHideTimerRef.current)
        pickBubbleHideTimerRef.current = null
      }
      mapPickBubbleOverlayRef.current?.setMap(null)
      mapPickBubbleOverlayRef.current = null
      mapRef.current = null
      // 같은 div에 Map을 두 번 만들면 SDK 내부 이벤트가 깨져 removeListener 등에서 터짐 (Strict Mode·재마운트)
      container.innerHTML = ''
    }
  }, [mapSdkReady])

  /** 그리드·lazy mount 직후 컨테이너 높이가 0이었다가 잡히는 경우·탭 복귀 시 타일이 비는 현상 완화 */
  useEffect(() => {
    const map = mapRef.current
    if (!mapSdkReady || !map) return
    const nudge = () => map.relayout?.()
    nudge()
    const raf = window.requestAnimationFrame(nudge)
    const t1 = window.setTimeout(nudge, 120)
    const t2 = window.setTimeout(nudge, 400)
    const onVis = () => {
      if (document.visibilityState === 'visible') nudge()
    }
    window.addEventListener('resize', nudge)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.cancelAnimationFrame(raf)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.removeEventListener('resize', nudge)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [mapSdkReady])

  useEffect(() => {
    const map = mapRef.current
    if (!mapSdkReady || !map || !mapRelayoutKey) return
    const nudge = () => map.relayout?.()
    nudge()
    const raf = window.requestAnimationFrame(nudge)
    const t1 = window.setTimeout(nudge, 160)
    const t2 = window.setTimeout(nudge, 520)
    return () => {
      window.cancelAnimationFrame(raf)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [mapSdkReady, mapRelayoutKey])

  useEffect(() => {
    const maps = getKakaoMaps()
    if (!mapSdkReady || !mapRef.current || !maps) return
    const map = mapRef.current

    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []
    overlaysRef.current.forEach((o) => o.setMap(null))
    overlaysRef.current = []
    userMarkerRef.current?.setMap(null)
    userMarkerRef.current = null

    if (userCoords) {
      const me = new maps.LatLng(userCoords.lat, userCoords.lng)
      userMarkerRef.current = new maps.Marker({
        map,
        position: me,
        title: '내 위치',
      })
    }

    const size = new maps.Size(40, 48)
    const offset = new maps.Point(20, 48)

    pins.forEach((p) => {
      const kind = p.markerKind ?? 'brog'
      let image: unknown
      try {
        const src =
          p.rank != null ? rankedBrogFlagMarkerUrl(p.rank, kind) : defaultBrogFlagMarkerUrl(kind)
        image = new maps.MarkerImage(src, size, { offset })
      } catch {
        image = undefined
      }
      const markerTitle = p.rank != null ? `${p.rank}. ${p.title}` : p.title
      const marker = new maps.Marker({
        map,
        position: new maps.LatLng(p.latitude, p.longitude),
        title: markerTitle,
        ...(image ? { image } : {}),
      })
      maps.event?.addListener(marker, 'click', () => {
        const path = p.href ?? getDetailPathRef.current(p.id)
        navigate(path)
      })
      markersRef.current.push(marker)
    })

    if (mapSpeechBubbles && typeof maps.CustomOverlay === 'function') {
      const speechRows: { pin: (typeof pins)[number]; speech: string; isWinner: boolean }[] = []
      pins.forEach((p) => {
        const speech = (p.mapSpeechLabel ?? p.title).trim()
        if (!speech) return
        const isWinner = winnerPinRank != null && p.rank != null && winnerPinRank === p.rank
        speechRows.push({ pin: p, speech, isWinner })
      })
      speechRows.sort((a, b) => {
        const wa = a.isWinner ? 1 : 0
        const wb = b.isWinner ? 1 : 0
        return wa - wb
      })
      speechRows.forEach(({ pin: p, speech, isWinner }) => {
        const anchor = document.createElement('div')
        anchor.className = 'brog-map-speech-anchor'
        anchor.setAttribute('role', 'link')
        anchor.tabIndex = 0
        anchor.setAttribute('aria-label', `${p.title} 상세 보기`)
        const goToDetail = () => {
          const path = p.href ?? getDetailPathRef.current(p.id)
          navigate(path)
        }
        const stopPickPropagation = (e: Event) => e.stopPropagation()
        anchor.addEventListener('mousedown', stopPickPropagation)
        anchor.addEventListener('touchstart', stopPickPropagation, { passive: true })
        const onAnchorActivate = (e: Event) => {
          e.preventDefault()
          e.stopPropagation()
          goToDetail()
        }
        anchor.addEventListener('click', onAnchorActivate)
        anchor.addEventListener('keydown', (e) => {
          const ke = e as KeyboardEvent
          if (ke.key === 'Enter' || ke.key === ' ') {
            onAnchorActivate(e)
          }
        })
        const bubble = document.createElement('div')
        bubble.className =
          'brog-map-speech-bubble' + (isWinner ? ' brog-map-speech-bubble--winner' : '')
        if (isWinner) {
          const winEl = document.createElement('div')
          winEl.className = 'brog-map-speech-bubble__win'
          winEl.textContent = '축 당첨!'
          bubble.appendChild(winEl)
        }
        const nameEl = document.createElement('div')
        nameEl.className = 'brog-map-speech-bubble__name'
        nameEl.textContent = speech
        bubble.appendChild(nameEl)
        const spacer = document.createElement('div')
        spacer.className = 'brog-map-speech-spacer'
        anchor.appendChild(bubble)
        anchor.appendChild(spacer)
        const overlay = new maps.CustomOverlay({
          map,
          position: new maps.LatLng(p.latitude, p.longitude),
          content: anchor,
          xAnchor: 0.5,
          yAnchor: 1,
          zIndex: isWinner ? 200 : 10,
        })
        overlaysRef.current.push(overlay)
      })
    }

    const extendPoints: unknown[] = []
    if (userCoords) {
      extendPoints.push(new maps.LatLng(userCoords.lat, userCoords.lng))
    }
    pins.forEach((p) => {
      extendPoints.push(new maps.LatLng(p.latitude, p.longitude))
    })

    const userAnchorKey = userCoords ? `${userCoords.lat.toFixed(6)},${userCoords.lng.toFixed(6)}` : ''
    const userAnchorMoved = prevUserAnchorKeyRef.current !== userAnchorKey
    const pinsFirstBatch = pins.length > 0 && prevPinsCountRef.current <= 0
    const pinsSig = pins.length > 0 ? pins.map((p) => p.id).join('|') : ''
    const pinsSameAsPrior = pinsSig === prevPinsKeyRef.current
    const shouldRefit = autoRefitWhenPinsChange
      ? true
      : userAnchorMoved || !hasDoneInitialFitRef.current || pinsFirstBatch

    /** 우클릭·롱프레스·GPS로 내 위치만 바뀐 경우 setBounds 하면 모든 깃발에 맞추느라 과하게 줌아웃됨 → 중심만 옮기고 줌 유지 */
    const preserveZoomOnlyUserMoved =
      Boolean(userCoords) &&
      userAnchorMoved &&
      hasDoneInitialFitRef.current &&
      pinsSameAsPrior &&
      !pinsFirstBatch

    if (shouldRefit) {
      ignoreExploreUntilRef.current = Date.now() + PROGRAMMATIC_MAP_MOVE_GUARD_MS
      if (preserveZoomOnlyUserMoved) {
        const prevLevel = map.getLevel?.() ?? 5
        map.setCenter(new maps.LatLng(userCoords!.lat, userCoords!.lng))
        map.setLevel?.(prevLevel)
      } else if (extendPoints.length >= 2 && typeof maps.LatLngBounds === 'function') {
        const bounds = new maps.LatLngBounds()
        extendPoints.forEach((pt) => bounds.extend(pt))
        map.setBounds(bounds)
      } else if (extendPoints.length === 1) {
        map.setCenter(extendPoints[0])
        map.setLevel?.(5)
      } else {
        map.setCenter(new maps.LatLng(SEOUL_DEFAULT.lat, SEOUL_DEFAULT.lng))
        map.setLevel?.(7)
      }
      hasDoneInitialFitRef.current = true
    }

    prevUserAnchorKeyRef.current = userAnchorKey
    prevPinsCountRef.current = pins.length
    prevPinsKeyRef.current = pinsSig

    window.requestAnimationFrame(() => mapRef.current?.relayout?.())
  }, [mapSdkReady, userCoords, pins, navigate, autoRefitWhenPinsChange, mapSpeechBubbles, winnerPinRank])

  useEffect(() => {
    const maps = getKakaoMaps()
    if (!mapSdkReady || !maps?.event || !onPickUserLocationOnMap) return
    const map = mapRef.current
    const container = mapContainerRef.current
    if (!map || !container) return

    const fire = (lat: number, lng: number) => {
      onPickUserLocationRef.current?.(lat, lng)
    }

    const showPickLocationBubble = (lat: number, lng: number) => {
      const label = pickLocationRightClickBubbleTextRef.current
      if (!label || typeof maps.CustomOverlay !== 'function') return
      if (pickBubbleHideTimerRef.current != null) {
        window.clearTimeout(pickBubbleHideTimerRef.current)
        pickBubbleHideTimerRef.current = null
      }
      mapPickBubbleOverlayRef.current?.setMap(null)
      mapPickBubbleOverlayRef.current = null

      const anchor = document.createElement('div')
      anchor.className = 'brog-map-speech-anchor brog-map-pick-bubble-anchor'
      const bubble = document.createElement('div')
      bubble.className = 'brog-map-speech-bubble brog-map-speech-bubble--pick-only'
      const nameEl = document.createElement('div')
      nameEl.className = 'brog-map-speech-bubble__name'
      nameEl.textContent = label
      bubble.appendChild(nameEl)
      const spacer = document.createElement('div')
      spacer.className = 'brog-map-speech-spacer'
      anchor.appendChild(bubble)
      anchor.appendChild(spacer)
      const overlay = new maps.CustomOverlay({
        map,
        position: new maps.LatLng(lat, lng),
        content: anchor,
        xAnchor: 0.5,
        yAnchor: 1,
        zIndex: 400,
      })
      mapPickBubbleOverlayRef.current = overlay
      pickBubbleHideTimerRef.current = window.setTimeout(() => {
        pickBubbleHideTimerRef.current = null
        mapPickBubbleOverlayRef.current?.setMap(null)
        mapPickBubbleOverlayRef.current = null
      }, 2600)
    }

    const handleRightClick = (mouseEvent: unknown) => {
      const me = mouseEvent as { latLng?: KakaoLatLngLike }
      const ll = me.latLng
      if (!ll || typeof ll.getLat !== 'function') return
      const lat = ll.getLat()
      const lng = ll.getLng()
      fire(lat, lng)
      showPickLocationBubble(lat, lng)
    }

    const listener = maps.event.addListener(map, 'rightclick', handleRightClick)

    let timer: number | null = null
    let startX = 0
    let startY = 0

    const clearTimer = () => {
      if (timer != null) {
        window.clearTimeout(timer)
        timer = null
      }
    }

    const pointFromClient = (clientX: number, clientY: number) => {
      const rect = container.getBoundingClientRect()
      return { x: clientX - rect.left, y: clientY - rect.top }
    }

    const fireFromContainerPoint = (x: number, y: number) => {
      const proj = map.getProjection?.()
      if (!proj?.coordsFromContainerPoint) return
      const ll = proj.coordsFromContainerPoint(new maps.Point(x, y))
      if (!ll || typeof ll.getLat !== 'function') return
      const lat = ll.getLat()
      const lng = ll.getLng()
      fire(lat, lng)
      showPickLocationBubble(lat, lng)
    }

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      const p = pointFromClient(e.clientX, e.clientY)
      startX = p.x
      startY = p.y
      clearTimer()
      timer = window.setTimeout(() => {
        timer = null
        fireFromContainerPoint(startX, startY)
      }, LONG_PRESS_MS)
    }

    const onMouseMove = (e: MouseEvent) => {
      const p = pointFromClient(e.clientX, e.clientY)
      if (Math.abs(p.x - startX) > LONG_PRESS_MOVE_PX || Math.abs(p.y - startY) > LONG_PRESS_MOVE_PX) {
        clearTimer()
      }
    }

    const onMouseUpLeave = () => {
      clearTimer()
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      const t = e.touches[0]
      const p = pointFromClient(t.clientX, t.clientY)
      startX = p.x
      startY = p.y
      clearTimer()
      timer = window.setTimeout(() => {
        timer = null
        fireFromContainerPoint(startX, startY)
      }, LONG_PRESS_MS)
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      const t = e.touches[0]
      const p = pointFromClient(t.clientX, t.clientY)
      if (Math.abs(p.x - startX) > LONG_PRESS_MOVE_PX || Math.abs(p.y - startY) > LONG_PRESS_MOVE_PX) {
        clearTimer()
      }
    }

    const onTouchEndCancel = () => {
      clearTimer()
    }

    const onContextMenu = (e: Event) => {
      e.preventDefault()
    }

    container.addEventListener('mousedown', onMouseDown)
    container.addEventListener('mousemove', onMouseMove)
    container.addEventListener('mouseup', onMouseUpLeave)
    container.addEventListener('mouseleave', onMouseUpLeave)
    container.addEventListener('touchstart', onTouchStart, { passive: true })
    container.addEventListener('touchmove', onTouchMove, { passive: true })
    container.addEventListener('touchend', onTouchEndCancel)
    container.addEventListener('touchcancel', onTouchEndCancel)
    container.addEventListener('contextmenu', onContextMenu)

    return () => {
      clearTimer()
      // SDK가 내부 핸들을 이미 걷었을 때(undefined.removeListener) React teardown에서 터지는 경우 방지
      if (listener != null && maps.event && typeof maps.event.removeListener === 'function') {
        try {
          maps.event.removeListener(listener)
        } catch {
          /* ignore */
        }
      }
      container.removeEventListener('mousedown', onMouseDown)
      container.removeEventListener('mousemove', onMouseMove)
      container.removeEventListener('mouseup', onMouseUpLeave)
      container.removeEventListener('mouseleave', onMouseUpLeave)
      container.removeEventListener('touchstart', onTouchStart)
      container.removeEventListener('touchmove', onTouchMove)
      container.removeEventListener('touchend', onTouchEndCancel)
      container.removeEventListener('touchcancel', onTouchEndCancel)
      container.removeEventListener('contextmenu', onContextMenu)
    }
  }, [mapSdkReady, onPickUserLocationOnMap])

  useEffect(() => {
    const maps = getKakaoMaps()
    if (!mapSdkReady || !maps?.event || !onMapViewSettled) return
    const map = mapRef.current
    if (!map) return

    let debounceTimer: number | null = null
    const flush = () => {
      if (Date.now() < ignoreExploreUntilRef.current) return
      const c = map.getCenter?.()
      if (!c || typeof c.getLat !== 'function') return
      onMapViewSettledRef.current?.(c.getLat(), c.getLng())
    }
    const onIdle = () => {
      if (debounceTimer != null) window.clearTimeout(debounceTimer)
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null
        flush()
      }, mapViewSettleDebounceMs)
    }

    const listener = maps.event.addListener(map, 'idle', onIdle)

    return () => {
      if (debounceTimer != null) window.clearTimeout(debounceTimer)
      if (listener != null && maps.event && typeof maps.event.removeListener === 'function') {
        try {
          maps.event.removeListener(listener)
        } catch {
          /* ignore */
        }
      }
    }
  }, [mapSdkReady, onMapViewSettled, mapViewSettleDebounceMs])

  if (!KAKAO_MAP_APP_KEY) {
    return (
      <div className={shellPlaceholderClassName}>
        <p className="muted home-hub__map-placeholder-text">
          <code>.env</code>의 <code>VITE_KAKAO_MAP_APP_KEY</code>(JavaScript 키)를 넣으면 지도가 표시됩니다.
        </p>
      </div>
    )
  }

  return (
    <div className={shellClassName}>
      {mapLoadError ? <p className={`error ${errorClassName}`}>{mapLoadError}</p> : null}
      <div ref={mapContainerRef} className={canvasClassName} role="application" aria-label={mapAriaLabel} />
      {showInteractionHints && (onMapViewSettled || onPickUserLocationOnMap) ? (
        <p className="brog-map-longpress-hint helper">
          {onMapViewSettled ? (
            <>
              지도를 <strong>움직이면</strong> 잠시 뒤 화면 중심 기준으로 목록이 다시 맞춰집니다.{' '}
            </>
          ) : null}
          {onPickUserLocationOnMap ? (
            pickLocationHint ?? (
              <>
                지도를 <strong>길게 누르거나</strong> <strong>우클릭</strong>하면 그 지점을 내 위치로 잡습니다.
                {onMapViewSettled ? ' (롱프레스는 드래그하면 취소)' : ' (드래그하면 취소)'}
              </>
            )
          ) : null}
        </p>
      ) : null}
      {showInteractionHints && pins.length > 0 ? (
        <p className="brog-map-marker-legend helper">
          깃발 색: <span className="brog-map-marker-legend__franchise">■</span> 가맹점 ·{' '}
          <span className="brog-map-marker-legend__brog">■</span> BroG ·{' '}
          <span className="brog-map-marker-legend__myg">■</span> MyG
        </p>
      ) : null}
      <button
        type="button"
        className="home-hub__map-locate"
        title="내 현재 위치로 이동"
        aria-label="내 현재 위치로 이동"
        disabled={locating}
        onClick={onMyLocationClick}
      >
        <span className="home-hub__map-locate-icon" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </svg>
        </span>
        <span className="home-hub__map-locate-label">{locating ? '위치…' : '내 위치'}</span>
      </button>
    </div>
  )
}
