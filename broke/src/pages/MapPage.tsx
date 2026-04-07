import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { ACCESS_TOKEN_KEY, fetchMe, type User } from '../api/auth'
import { deleteRestaurant, fetchRestaurants, type RestaurantListItem } from '../api/restaurants'
import { BrogRankCard } from '../components/BrogRankCard'
import { canManageBrogForDistrict, isSuperAdmin } from '../lib/roles'
import { KAKAO_MAP_APP_KEY } from '../api/config'
import { ensureKakaoMapsReady } from '../lib/kakaoMapsSdk'

type LocationState = {
  latitude: number
  longitude: number
}

type KakaoMapInstance = {
  setCenter: (latlng: unknown) => void
  setBounds: (bounds: unknown) => void
  setLevel?: (level: number) => void
  relayout?: () => void
}

type KakaoMarkerInstance = {
  setMap: (map: KakaoMapInstance | null) => void
}

/** 카카오맵 깃발 마커 (SVG data URL) */
const BROG_FLAG_MARKER_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 48" width="40" height="48">
    <ellipse cx="20" cy="44" rx="5" ry="3" fill="rgba(0,0,0,.18)"/>
    <rect x="17" y="10" width="3.5" height="34" rx="1" fill="#2a3142"/>
    <path d="M20.5 10 L38 19 L20.5 28 Z" fill="#c9a227" stroke="#8b7324" stroke-width="1"/>
    <path d="M20.5 12 L35 19 L20.5 26 Z" fill="#f5e6b8" opacity=".4"/>
  </svg>`,
)
const BROG_FLAG_MARKER_URL = `data:image/svg+xml,${BROG_FLAG_MARKER_SVG}`

declare global {
  interface Window {
    kakao?: {
      maps: {
        load: (callback: () => void) => void
        event?: {
          addListener: (target: unknown, type: string, handler: () => void) => void
        }
        LatLng: new (lat: number, lng: number) => unknown
        LatLngBounds: new () => {
          extend: (latlng: unknown) => void
        }
        Map: new (container: HTMLElement, options: Record<string, unknown>) => KakaoMapInstance
        Marker: new (options: Record<string, unknown>) => KakaoMarkerInstance
        MarkerImage: new (
          src: string,
          size: unknown,
          options?: { offset?: unknown },
        ) => unknown
        Size: new (width: number, height: number) => unknown
        Point: new (x: number, y: number) => unknown
      }
    }
  }
}

const PRICE_FILTER_MAX_OPTIONS = [10000, 9000, 8000, 7000, 6000, 5000] as const

const MAP_LOG = '[Brogourmet Map]'
const DEFAULT_DISTRICT = '마포구'
const MAPO_LOCATION: LocationState = {
  latitude: 37.5563,
  longitude: 126.922,
}

export function MapPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [currentLocation, setCurrentLocation] = useState<LocationState | null>(null)
  const [locationError, setLocationError] = useState('')
  const [isLocating, setIsLocating] = useState(false)
  const [maxPrice, setMaxPrice] = useState(10000)
  const [restaurants, setRestaurants] = useState<RestaurantListItem[]>([])
  const [listError, setListError] = useState('')
  const [isListLoading, setIsListLoading] = useState(true)
  const [mapSdkReady, setMapSdkReady] = useState(false)
  const [mapLoadError, setMapLoadError] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const mapRef = useRef<KakaoMapInstance | null>(null)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const markersRef = useRef<KakaoMarkerInstance[]>([])
  const userMarkerRef = useRef<KakaoMarkerInstance | null>(null)

  const mode = searchParams.get('mode')
  const city = searchParams.get('city') ?? '서울특별시'
  const district = searchParams.get('district') ?? DEFAULT_DISTRICT

  const pageTitle = useMemo(() => {
    if (mode === 'current') {
      return '마포구 BroG'
    }
    return `${district} BroG`
  }, [district, mode])

  const token = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null

  useEffect(() => {
    if (!token) {
      setUser(null)
      return
    }
    void fetchMe(token).then(setUser).catch(() => setUser(null))
  }, [token])

  function canDeleteRow(r: RestaurantListItem): boolean {
    if (!user) return false
    if (isSuperAdmin(user.role)) return true
    return canManageBrogForDistrict(user.role, user.managed_district_id, r.district_id)
  }

  async function handleSoftDelete(restaurant: RestaurantListItem) {
    if (!token) {
      window.alert('로그인 후 삭제할 수 있습니다.')
      return
    }
    if (!window.confirm(`「${restaurant.name}」을(를) 지도·목록에서 숨길까요?`)) {
      return
    }
    try {
      await deleteRestaurant(token, restaurant.id)
      setRestaurants((prev) => prev.filter((x) => x.id !== restaurant.id))
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '삭제에 실패했습니다.')
    }
  }

  useEffect(() => {
    let cancelled = false
    setIsListLoading(true)
    setListError('')

    async function load() {
      try {
        if (mode === 'current') {
          const data = await fetchRestaurants({ district: DEFAULT_DISTRICT, max_price: maxPrice, limit: 4 })
          if (!cancelled) {
            setRestaurants(data)
          }
        } else {
          const data = await fetchRestaurants({ district, max_price: maxPrice })
          if (!cancelled) {
            setRestaurants(data)
          }
        }
      } catch (error) {
        if (!cancelled) {
          setRestaurants([])
          setListError(error instanceof Error ? error.message : '맛집 목록을 불러오지 못했습니다.')
        }
      } finally {
        if (!cancelled) {
          setIsListLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [district, maxPrice, mode])

  useEffect(() => {
    setIsLocating(true)
    setCurrentLocation(MAPO_LOCATION)
    setLocationError('')
    setIsLocating(false)
  }, [])

  useEffect(() => {
    if (!KAKAO_MAP_APP_KEY) {
      console.warn(MAP_LOG, 'MapPage: VITE_KAKAO_MAP_APP_KEY 없음 — .env 확인')
      return
    }

    console.log(MAP_LOG, 'MapPage: SDK 로드 effect 시작', {
      href: typeof window !== 'undefined' ? window.location.href : '',
    })

    let cancelled = false

    ensureKakaoMapsReady(KAKAO_MAP_APP_KEY)
      .then(() => {
        if (cancelled) {
          console.log(MAP_LOG, 'MapPage: SDK 준비됐으나 effect 이미 취소(Strict Mode 등)')
          return
        }
        console.log(MAP_LOG, 'MapPage: setMapSdkReady(true)')
        setMapSdkReady(true)
        setMapLoadError('')
      })
      .catch((err) => {
        console.error(MAP_LOG, 'MapPage: ensureKakaoMapsReady 실패', err)
        if (!cancelled) {
          setMapSdkReady(false)
          const origin = typeof window !== 'undefined' ? window.location.origin : '(현재 주소)'
          const base = `주소창 origin과 콘솔 등록이 일치해야 합니다. 《${origin}》 (localhost와 http://127.0.0.1:5173 은 서로 다름) 카카오 콘솔 → 앱 → 플랫폼 Web 사이트 도메인 + JavaScript 키 항목의 SDK 도메인을 둘 다 확인하세요. `
          const hint =
            'sdk.js 401·실패 시: JavaScript 키(플랫폼 키)인지, JavaScript SDK 도메인에 현재 주소가 등록됐는지 확인하세요. REST API 키는 appkey에 넣지 마세요.'
          setMapLoadError(
            `${err instanceof Error ? `${err.message} ` : ''}${base}${hint}`,
          )
        }
      })

    return () => {
      console.log(MAP_LOG, 'MapPage: SDK 로드 effect cleanup')
      cancelled = true
    }
  }, [])

  useLayoutEffect(() => {
    if (!mapSdkReady || !window.kakao?.maps) {
      if (mapSdkReady && !window.kakao?.maps) {
        console.warn(MAP_LOG, 'MapPage: mapSdkReady인데 window.kakao.maps 없음')
      }
      return
    }
    const container = mapContainerRef.current
    if (!container) {
      console.warn(MAP_LOG, 'MapPage: mapContainerRef 없음 — DOM 미연결')
      return
    }
    if (mapRef.current) {
      console.log(MAP_LOG, 'MapPage: 지도 인스턴스 이미 있음 — 생성 스킵')
      return
    }

    console.log(MAP_LOG, 'MapPage: new kakao.maps.Map 생성', {
      containerSize: { w: container.offsetWidth, h: container.offsetHeight },
    })

    const { maps } = window.kakao
    mapRef.current = new maps.Map(container, {
      center: new maps.LatLng(MAPO_LOCATION.latitude, MAPO_LOCATION.longitude),
      level: 6,
    })

    const map = mapRef.current
    const scheduleRelayout = () => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          map.relayout?.()
        })
      })
    }
    scheduleRelayout()

    const ro = new ResizeObserver(() => {
      map.relayout?.()
    })
    ro.observe(container)

    return () => {
      console.log(MAP_LOG, 'MapPage: 지도 layout effect cleanup')
      ro.disconnect()
      markersRef.current.forEach((m) => m.setMap(null))
      markersRef.current = []
      userMarkerRef.current?.setMap(null)
      userMarkerRef.current = null
      mapRef.current = null
    }
  }, [mapSdkReady])

  useEffect(() => {
    if (!mapSdkReady || !mapRef.current || !window.kakao?.maps) {
      return
    }

    console.log(MAP_LOG, 'MapPage: 센터/마커 갱신', {
      mode,
      hasCurrentLocation: Boolean(currentLocation),
      restaurantCount: restaurants.length,
    })

    const { maps } = window.kakao
    const map = mapRef.current
    const seoulDefault = new maps.LatLng(MAPO_LOCATION.latitude, MAPO_LOCATION.longitude)
    const fallbackCenter = currentLocation
      ? new maps.LatLng(currentLocation.latitude, currentLocation.longitude)
      : seoulDefault

    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []
    userMarkerRef.current?.setMap(null)
    userMarkerRef.current = null

    if (currentLocation) {
      const me = new maps.LatLng(currentLocation.latitude, currentLocation.longitude)
      userMarkerRef.current = new maps.Marker({
        map,
        position: me,
        title: '내 위치',
      })
    }

    let flagImage: unknown
    try {
      const size = new maps.Size(40, 48)
      const offset = new maps.Point(20, 48)
      flagImage = new maps.MarkerImage(BROG_FLAG_MARKER_URL, size, { offset })
    } catch {
      flagImage = undefined
    }

    const withCoords = restaurants.filter((r) => r.latitude != null && r.longitude != null)
    withCoords.forEach((restaurant) => {
      const marker = new maps.Marker({
        map,
        position: new maps.LatLng(restaurant.latitude as number, restaurant.longitude as number),
        title: restaurant.name,
        ...(flagImage ? { image: flagImage } : {}),
      })
      maps.event?.addListener(marker, 'click', () => {
        navigate(`/restaurants/${restaurant.id}`)
      })
      markersRef.current.push(marker)
    })

    if (withCoords.length > 0 && typeof maps.LatLngBounds === 'function') {
      const bounds = new maps.LatLngBounds()
      withCoords.forEach((r) => {
        bounds.extend(new maps.LatLng(r.latitude as number, r.longitude as number))
      })
      if (currentLocation) {
        bounds.extend(new maps.LatLng(currentLocation.latitude, currentLocation.longitude))
      }
      map.setBounds(bounds)
    } else if (mode === 'current' && currentLocation) {
      map.setCenter(new maps.LatLng(currentLocation.latitude, currentLocation.longitude))
      map.setLevel?.(4)
    } else {
      map.setCenter(fallbackCenter)
    }

    window.requestAnimationFrame(() => {
      mapRef.current?.relayout?.()
    })
  }, [mapSdkReady, restaurants, currentLocation, mode, navigate])

  return (
    <div className="map-layout map-layout--brog brog-screen brog-screen--map">
      <section className="map-hero map-hero--compact brog-screen__header brog-screen__header--map">
        <div>
          <p className="eyebrow">BroG · 지도</p>
          <h2 className="brog-screen__title">{pageTitle}</h2>
          <p className="description map-hero__meta brog-screen__meta">
            {mode === 'current' ? '마포구 고정 위치 기준' : `${city} ${district}`} · 대표 메뉴{' '}
            {maxPrice.toLocaleString()}원 이하
          </p>
        </div>
        <div className="hero-actions brog-screen__header-actions">
          <Link className="ghost-button" to="/">
            Home
          </Link>
          <Link
            className="ghost-button"
            to={`/brog/list?city=${encodeURIComponent(city)}&district=${encodeURIComponent(district)}`}
          >
            리스트
          </Link>
          <Link className="brog-screen__cta" to="/restaurants/manage/new">
            BroG 등록
          </Link>
        </div>
      </section>

      <div className="map-page-toolbar map-card">
        <label className="price-filter map-page-toolbar__filter">
          가격 상한
          <select value={maxPrice} onChange={(event) => setMaxPrice(Number(event.target.value))}>
            {PRICE_FILTER_MAX_OPTIONS.map((price) => (
              <option key={price} value={price}>
                {price.toLocaleString()}원 이하
              </option>
            ))}
          </select>
        </label>
        <p className="map-page-toolbar__geo">
          <span className="helper" style={{ display: 'block', marginBottom: 6 }}>
            담당 권한이 있으면 아래 카드에서 바로 숨김 삭제할 수 있습니다.
          </span>
          {isLocating ? '마포구 기준 위치 반영 중…' : null}
          {!isLocating && currentLocation ? (
            <span>{mode === 'current' ? '마포구 기준 · ' : ''}지도에 고정 위치 표시됨</span>
          ) : null}
          {!isLocating && !currentLocation && locationError ? (
            <span className="error">{locationError}</span>
          ) : null}
          {!isLocating && !currentLocation && !locationError && mode !== 'current' ? (
            <span className="muted">지역은 홈에서 선택한 구 기준입니다.</span>
          ) : null}
        </p>
      </div>

      <section className="home-section brog-rank-section">
        {listError ? <p className="error">{listError}</p> : null}
        {isListLoading ? <p className="brog-rank-loading">맛집을 불러오는 중…</p> : null}

        {!isListLoading && restaurants.length === 0 && !listError ? (
          <article className="brog-rank-card brog-rank-card--empty">
            <p className="brog-rank-card__name brog-rank-card__name--primary">조건에 맞는 맛집이 없습니다</p>
            <p className="brog-rank-section__sub">가격 상한을 조정하거나 홈에서 다른 구를 선택해 보세요.</p>
          </article>
        ) : (
          <ul className="brog-rank-grid">
            {restaurants.map((restaurant, index) => (
              <li key={restaurant.id}>
                <BrogRankCard
                  restaurant={restaurant}
                  rank={index + 1}
                  footer={
                    canDeleteRow(restaurant) ? (
                      <button
                        type="button"
                        className="brog-rank-card__delete-btn"
                        onClick={() => void handleSoftDelete(restaurant)}
                      >
                        목록에서 숨기기
                      </button>
                    ) : null
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="map-page-map-section map-card">
        <h3 className="map-page-map-section__title">위치 지도</h3>
        <p className="map-page-map-section__hint">깃발 마커는 등록된 음식점 위치입니다.</p>
        {KAKAO_MAP_APP_KEY ? (
          <>
            {mapLoadError ? <p className="error">{mapLoadError}</p> : null}
            <div ref={mapContainerRef} className="kakao-map-container kakao-map-container--below" />
          </>
        ) : (
          <>
            <p className="muted">
              <code>broke/.env</code>의 <code>VITE_KAKAO_MAP_APP_KEY</code>에는 카카오 콘솔의{' '}
              <strong>JavaScript 키</strong>만 넣으세요. REST API 키는 지도에 사용할 수 없습니다.
            </p>
            <div className="placeholder-box">MAP</div>
          </>
        )}
      </section>
    </div>
  )
}
