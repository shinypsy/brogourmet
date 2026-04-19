import { useCallback, useEffect, useMemo, useState } from 'react'
import { ACCESS_TOKEN_KEY } from '../api/auth'
import { KAKAO_MAP_APP_KEY } from '../api/config'
import { fetchKnownRestaurantPosts } from '../api/community'
import type { KnownRestaurantPost } from '../api/community'
import { fetchRestaurants } from '../api/restaurants'
import type { RestaurantListItem } from '../api/restaurants'
import { BrogKakaoMap } from '../components/BrogKakaoMap'
import { LadderGame } from '../components/LadderGame'
import { BROG_CATEGORIES, type BrogCategory } from '../lib/brogCategories'
import { BrogCategoryPickerIcon, BrogGameTasteAnyIcon } from '../lib/brogCategoryPickerIcons'
import { geolocationFailureMessage, requestGeolocation } from '../lib/requestGeolocation'
import { buildSadariCandidates } from '../lib/buildSadariCandidates'
import { filterBrogsToStage1IfNeeded, filterMygPostsToStage1IfNeeded } from '../lib/deployStage1'
import type { BrogKakaoMapPin } from '../components/BrogKakaoMap'
import type { SadariCandidate } from '../lib/buildSadariCandidates'

/** GPS 없는 PC·브라우저 차단 시 데모·테스트용 (지하철 2호선 신촌역 인근) */
const SHINCHON_STATION_DEMO = { lat: 37.55505, lng: 126.93682 }

type GeoState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'ok'; lat: number; lng: number }
  | { status: 'error'; message: string }

type TasteChoice = BrogCategory | 'any'

type RawPlaces = {
  lat: number
  lng: number
  myg: KnownRestaurantPost[]
  brog: RestaurantListItem[]
}

export function SadariPage() {
  const [geo, setGeo] = useState<GeoState>({ status: 'idle' })
  const [geoRetryToken, setGeoRetryToken] = useState(0)
  const [raw, setRaw] = useState<RawPlaces | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loadingPlaces, setLoadingPlaces] = useState(false)
  const [taste, setTaste] = useState<TasteChoice | null>(null)
  const [mapLocating, setMapLocating] = useState(false)
  const [manualLat, setManualLat] = useState('37.55505')
  const [manualLng, setManualLng] = useState('126.93682')
  const [manualCoordError, setManualCoordError] = useState('')
  const [winnerMapRank, setWinnerMapRank] = useState<number | null>(null)

  const handleWinnerPinRank = useCallback((rank: number | null) => {
    setWinnerMapRank(rank)
  }, [])

  const fetchPlaces = useCallback(async (lat: number, lng: number) => {
    setLoadingPlaces(true)
    setLoadError('')
    try {
      const mygToken = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null
      const [myg, brog] = await Promise.all([
        fetchKnownRestaurantPosts(mygToken),
        fetchRestaurants({
          max_price: 10_000,
          limit: 120,
          near_lat: lat,
          near_lng: lng,
          radius_m: 1000,
        }),
      ])
      setRaw({
        lat,
        lng,
        myg: filterMygPostsToStage1IfNeeded(myg),
        brog: filterBrogsToStage1IfNeeded(brog),
      })
    } catch (e) {
      setRaw(null)
      setLoadError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.')
    } finally {
      setLoadingPlaces(false)
    }
  }, [])

  /** 취향을 고른 뒤에만 위치 요청·주변 목록 로드(게임 진입 시 취향 블록만 보이게) */
  const shouldStartGeo = taste !== null

  useEffect(() => {
    if (!shouldStartGeo) return

    let cancelled = false

    async function run() {
      if (!navigator.geolocation) {
        setGeo({ status: 'error', message: geolocationFailureMessage(new Error('unsupported')) })
        return
      }
      setGeo({ status: 'pending' })
      try {
        const coords = await requestGeolocation()
        if (cancelled) return
        const lat = coords.latitude
        const lng = coords.longitude
        setGeo({ status: 'ok', lat, lng })
        void fetchPlaces(lat, lng)
      } catch (e) {
        if (cancelled) return
        setGeo({ status: 'error', message: geolocationFailureMessage(e) })
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [shouldStartGeo, fetchPlaces, geoRetryToken])

  const candidates: SadariCandidate[] | null = useMemo(() => {
    if (!raw || taste === null) return null
    return buildSadariCandidates(raw.lat, raw.lng, raw.myg, raw.brog, {
      preferredCategory: taste === 'any' ? null : taste,
    })
  }, [raw, taste])

  useEffect(() => {
    setWinnerMapRank(null)
  }, [candidates])

  function retryGeo() {
    setRaw(null)
    setLoadError('')
    setTaste(null)
    setManualCoordError('')
    setGeo({ status: 'idle' })
    setGeoRetryToken((t) => t + 1)
  }

  function applyManualCoords() {
    const lat = Number.parseFloat(manualLat.replace(',', '.'))
    const lng = Number.parseFloat(manualLng.replace(',', '.'))
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setManualCoordError('위도·경도는 숫자로 입력해 주세요.')
      return
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setManualCoordError('위도는 -90~90, 경도는 -180~180 범위여야 합니다.')
      return
    }
    setManualCoordError('')
    setGeo({ status: 'ok', lat, lng })
    void fetchPlaces(lat, lng)
  }

  function startWithDemoShinchon() {
    setManualCoordError('')
    setManualLat(SHINCHON_STATION_DEMO.lat.toFixed(5))
    setManualLng(SHINCHON_STATION_DEMO.lng.toFixed(5))
    setGeo({ status: 'ok', lat: SHINCHON_STATION_DEMO.lat, lng: SHINCHON_STATION_DEMO.lng })
    void fetchPlaces(SHINCHON_STATION_DEMO.lat, SHINCHON_STATION_DEMO.lng)
  }

  const sadariMapPins = useMemo((): BrogKakaoMapPin[] => {
    if (!raw) return []
    if (candidates && candidates.length > 0) {
      const pins: BrogKakaoMapPin[] = []
      candidates.forEach((c, i) => {
        const rank = i + 1
        const brogM = /^brog-(\d+)/.exec(c.key)
        if (brogM) {
          const id = Number(brogM[1])
          const r = raw.brog.find((x) => x.id === id)
          if (r?.latitude != null && r.longitude != null) {
            pins.push({
              id,
              title: r.name,
              mapSpeechLabel: c.label,
              latitude: r.latitude,
              longitude: r.longitude,
              rank,
              href: c.href,
              markerKind: r.is_franchise ? 'franchise' : 'brog',
            })
          }
          return
        }
        const mygM = /^myg-(\d+)/.exec(c.key)
        if (mygM) {
          const id = Number(mygM[1])
          const p = raw.myg.find((x) => x.id === id)
          if (p?.latitude != null && p.longitude != null) {
            pins.push({
              id,
              title: p.restaurant_name || p.title,
              mapSpeechLabel: c.label,
              latitude: p.latitude,
              longitude: p.longitude,
              rank,
              href: c.href,
              markerKind: 'myg',
            })
          }
        }
      })
      return pins
    }
    return (raw.brog ?? [])
      .filter((r) => r.latitude != null && r.longitude != null)
      .map((r) => ({
        id: r.id,
        title: r.name,
        latitude: r.latitude as number,
        longitude: r.longitude as number,
        markerKind: r.is_franchise ? ('franchise' as const) : ('brog' as const),
      }))
  }, [raw, candidates])

  const sadariMapRelayoutKey = useMemo(() => {
    return [
      raw ? 'p' : 'x',
      taste ?? '',
      candidates?.map((c) => c.key).join('|') ?? '',
      String(winnerMapRank ?? ''),
      String(sadariMapPins.length),
    ].join(':')
  }, [raw, taste, candidates, winnerMapRank, sadariMapPins.length])

  async function handleMapMyLocation() {
    if (!navigator.geolocation) return
    setMapLocating(true)
    try {
      const coords = await requestGeolocation()
      const lat = coords.latitude
      const lng = coords.longitude
      setGeo({ status: 'ok', lat, lng })
      void fetchPlaces(lat, lng)
    } catch (e) {
      setGeo({ status: 'error', message: geolocationFailureMessage(e) })
    } finally {
      setMapLocating(false)
    }
  }

  const onPickUserLocationOnMap = useCallback(
    (lat: number, lng: number) => {
      setGeo({ status: 'ok', lat, lng })
      void fetchPlaces(lat, lng)
    },
    [fetchPlaces],
  )

  return (
    <section className="page game-page">
      <header className="brog-screen__header game-page__screen-header" aria-label="점메추 게임">
        <div>
          <p className="eyebrow">Game · 점메추</p>
          <h2 className="game-page__hook game-page__hook--header">점메추천 SADARI 게임~!</h2>
        </div>
      </header>

      <div className="game-page__taste-block">
        <h3 className="game-page__taste-title">무슨 음식을 좋아하세요?</h3>
        <div
          className="brog-category-picker brog-category-picker--with-icons"
          role="group"
          aria-label="음식 취향"
        >
          {BROG_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={
                'brog-category-picker__btn' +
                (taste === cat ? ' brog-category-picker__btn--active' : '')
              }
              onClick={() => setTaste(cat)}
            >
              <span className="brog-category-picker__icon-wrap" aria-hidden>
                <BrogCategoryPickerIcon category={cat} />
              </span>
              <span className="brog-category-picker__label">{cat}</span>
            </button>
          ))}
          <button
            type="button"
            className={
              'brog-category-picker__btn brog-category-picker__btn--game-any' +
              (taste === 'any' ? ' brog-category-picker__btn--active' : '')
            }
            onClick={() => setTaste('any')}
          >
            <span className="brog-category-picker__icon-wrap" aria-hidden>
              <BrogGameTasteAnyIcon />
            </span>
            <span className="brog-category-picker__label">상관없음</span>
          </button>
        </div>
        {taste != null ? (
          <button type="button" className="compact-link game-page__taste-reset" onClick={() => setTaste(null)}>
            취향 다시 고르기
          </button>
        ) : null}
      </div>

      {shouldStartGeo && geo.status === 'pending' ? (
        <p className="muted">위치 확인 중… 최대 약 1분까지 여러 번 시도합니다. 실내·Wi-Fi만 켠 경우 더 걸릴 수 있습니다.</p>
      ) : null}
      {shouldStartGeo && geo.status === 'error' ? (
        <div className="game-page__geo-fallback">
          <div className="game-page__geo-error">
            <p className="error">{geo.message}</p>
            <button type="button" className="ghost-button" onClick={retryGeo}>
              위치 다시 시도
            </button>
          </div>
          <div
            className="home-hub__coord-edit map-page__coord-edit game-page__manual-coords"
            aria-label="위도 경도 직접 입력"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                applyManualCoords()
              }
            }}
          >
            <div className="home-hub__coord-row map-page-toolbar__coord-row">
              <label className="home-hub__coord-field">
                위도
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  spellCheck={false}
                  className="home-hub__coord-input"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                  placeholder="예: 37.55505"
                  aria-label="위도"
                />
              </label>
              <label className="home-hub__coord-field">
                경도
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  spellCheck={false}
                  className="home-hub__coord-input"
                  value={manualLng}
                  onChange={(e) => setManualLng(e.target.value)}
                  placeholder="예: 126.93682"
                  aria-label="경도"
                />
              </label>
              <button type="button" className="home-hub__coord-apply" onClick={applyManualCoords}>
                좌표로 시작
              </button>
            </div>
            {manualCoordError ? <p className="error home-hub__coord-error">{manualCoordError}</p> : null}
            <button
              type="button"
              className="game-page__demo-shinchon"
              onClick={startWithDemoShinchon}
              title="2호선 신촌역 인근 좌표로 시작"
            >
              <span className="game-page__demo-shinchon__icon" aria-hidden>
                <svg
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 11h16v7H4zM6 11V9h12v2" />
                  <path d="M8 7V5h8v2M9 18v2M15 18v2" />
                  <path d="M7 14h2M11 14h2M15 14h2" opacity="0.85" />
                </svg>
              </span>
              <span className="game-page__demo-shinchon__label">신촌역 데모 시작</span>
            </button>
          </div>
        </div>
      ) : null}

      {shouldStartGeo && geo.status === 'ok' ? (
        <p className="muted game-page__geo-ok">
          기준 좌표: {geo.lat.toFixed(5)}, {geo.lng.toFixed(5)}
        </p>
      ) : null}

      {shouldStartGeo && loadingPlaces ? <p>주변 맛집 불러오는 중…</p> : null}
      {shouldStartGeo && loadError ? <p className="error">{loadError}</p> : null}

      {taste === null ? (
        <p className="muted game-page__pick-first">취향을 선택하면 주변 지도와 사다리 게임이 표시됩니다.</p>
      ) : null}

      {shouldStartGeo &&
      geo.status === 'ok' &&
      KAKAO_MAP_APP_KEY &&
      !loadingPlaces &&
      !loadError ? (
        <div className="map-layout map-layout--brog brog-screen brog-screen--map game-page__map-stack">
          {geo.status === 'ok' && KAKAO_MAP_APP_KEY ? (
            <section className="map-page-map-section map-card">
              <h3 className="map-page-map-section__title">주변 지도</h3>
              <BrogKakaoMap
                userCoords={{ lat: geo.lat, lng: geo.lng }}
                pins={sadariMapPins}
                locating={mapLocating}
                onMyLocationClick={() => void handleMapMyLocation()}
                onPickUserLocationOnMap={onPickUserLocationOnMap}
                getDetailPath={(id) => `/restaurants/${id}`}
                winnerPinRank={winnerMapRank}
                mapSpeechBubbles={Boolean(candidates?.length)}
                mapAriaLabel="점메추 주변 지도"
                shellClassName="kakao-map-embed"
                canvasClassName="kakao-map-container kakao-map-container--below"
                mapRelayoutKey={sadariMapRelayoutKey}
                showInteractionHints={false}
              />
            </section>
          ) : null}
          {candidates && !loadingPlaces ? (
            <LadderGame
              key={candidates.map((c) => c.key).join('-')}
              candidates={candidates}
              onWinnerPinRank={handleWinnerPinRank}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
