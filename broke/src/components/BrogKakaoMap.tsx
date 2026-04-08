import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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
  /** `franchise` 빨강 · `brog` 파랑(BroG) · `myg` 노랑(MyG). 기본 `brog`. */
  markerKind?: BrogMapMarkerKind
}

type KakaoLatLngLike = {
  getLat: () => number
  getLng: () => number
}

type KakaoMapInstance = {
  setCenter: (latlng: unknown) => void
  setBounds: (bounds: unknown) => void
  setLevel?: (level: number) => void
  relayout?: () => void
  getProjection?: () => {
    coordsFromContainerPoint: (point: unknown) => KakaoLatLngLike | null | undefined
  } | null
}

type KakaoMarkerInstance = {
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
  /** 마커 클릭 시 이동할 경로 */
  getDetailPath: (id: number) => string
  mapAriaLabel: string
  shellClassName?: string
  shellPlaceholderClassName?: string
  canvasClassName?: string
  errorClassName?: string
}

const DEFAULT_SHELL = 'home-hub__map-shell'
const DEFAULT_SHELL_PLACEHOLDER = 'home-hub__map-shell home-hub__map-shell--placeholder'
const DEFAULT_CANVAS = 'home-hub__map-canvas'
const DEFAULT_ERROR = 'home-hub__map-error'

const LONG_PRESS_MS = 550
const LONG_PRESS_MOVE_PX = 14

export function BrogKakaoMap({
  userCoords,
  pins,
  locating,
  onMyLocationClick,
  onPickUserLocationOnMap,
  getDetailPath,
  mapAriaLabel,
  shellClassName = DEFAULT_SHELL,
  shellPlaceholderClassName = DEFAULT_SHELL_PLACEHOLDER,
  canvasClassName = DEFAULT_CANVAS,
  errorClassName = DEFAULT_ERROR,
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
  const userMarkerRef = useRef<KakaoMarkerInstance | null>(null)
  const onPickUserLocationRef = useRef(onPickUserLocationOnMap)
  useLayoutEffect(() => {
    onPickUserLocationRef.current = onPickUserLocationOnMap
  }, [onPickUserLocationOnMap])

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
      userMarkerRef.current?.setMap(null)
      userMarkerRef.current = null
      mapRef.current = null
      // 같은 div에 Map을 두 번 만들면 SDK 내부 이벤트가 깨져 removeListener 등에서 터짐 (Strict Mode·재마운트)
      container.innerHTML = ''
    }
  }, [mapSdkReady])

  useEffect(() => {
    const maps = getKakaoMaps()
    if (!mapSdkReady || !mapRef.current || !maps) return
    const map = mapRef.current

    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []
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
        const src = p.rank != null ? rankedBrogFlagMarkerUrl(p.rank, kind) : defaultBrogFlagMarkerUrl(kind)
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

    const extendPoints: unknown[] = []
    if (userCoords) {
      extendPoints.push(new maps.LatLng(userCoords.lat, userCoords.lng))
    }
    pins.forEach((p) => {
      extendPoints.push(new maps.LatLng(p.latitude, p.longitude))
    })

    if (extendPoints.length >= 2 && typeof maps.LatLngBounds === 'function') {
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

    window.requestAnimationFrame(() => mapRef.current?.relayout?.())
  }, [mapSdkReady, userCoords, pins, navigate])

  useEffect(() => {
    const maps = getKakaoMaps()
    if (!mapSdkReady || !maps?.event || !onPickUserLocationOnMap) return
    const map = mapRef.current
    const container = mapContainerRef.current
    if (!map || !container) return

    const fire = (lat: number, lng: number) => {
      onPickUserLocationRef.current?.(lat, lng)
    }

    const handleRightClick = (mouseEvent: unknown) => {
      const me = mouseEvent as { latLng?: KakaoLatLngLike }
      const ll = me.latLng
      if (!ll || typeof ll.getLat !== 'function') return
      fire(ll.getLat(), ll.getLng())
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
      fire(ll.getLat(), ll.getLng())
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
      {onPickUserLocationOnMap ? (
        <p className="brog-map-longpress-hint helper">
          지도를 <strong>길게 누르거나</strong> <strong>우클릭</strong>하면 그 지점을 내 위치로 잡습니다. (드래그하면
          취소)
        </p>
      ) : null}
      {pins.length > 0 ? (
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
