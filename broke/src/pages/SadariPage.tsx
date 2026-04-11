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
import { geolocationFailureMessage, requestGeolocation } from '../lib/requestGeolocation'
import { buildSadariCandidates, SADARI_SLOT_COUNT } from '../lib/buildSadariCandidates'
import { filterBrogsToStage1IfNeeded, filterMygPostsToStage1IfNeeded } from '../lib/deployStage1'
import type { BrogKakaoMapPin } from '../components/BrogKakaoMap'
import type { SadariCandidate } from '../lib/buildSadariCandidates'

/** GPS 없는 PC·브라우저 차단 시 데모·테스트용 (서울 시청) */
const SEOUL_DEMO = { lat: 37.5665, lng: 126.978 }

type GeoState =
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
  const [geo, setGeo] = useState<GeoState>({ status: 'pending' })
  const [geoRetryToken, setGeoRetryToken] = useState(0)
  const [raw, setRaw] = useState<RawPlaces | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loadingPlaces, setLoadingPlaces] = useState(false)
  const [taste, setTaste] = useState<TasteChoice | null>(null)
  const [mapLocating, setMapLocating] = useState(false)
  const [manualLat, setManualLat] = useState('37.56650')
  const [manualLng, setManualLng] = useState('126.97800')
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
          radius_m: 2000,
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

  useEffect(() => {
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
  }, [fetchPlaces, geoRetryToken])

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

  function startWithDemoSeoul() {
    setManualCoordError('')
    setManualLat(SEOUL_DEMO.lat.toFixed(5))
    setManualLng(SEOUL_DEMO.lng.toFixed(5))
    setGeo({ status: 'ok', lat: SEOUL_DEMO.lat, lng: SEOUL_DEMO.lng })
    void fetchPlaces(SEOUL_DEMO.lat, SEOUL_DEMO.lng)
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
      <h2 className="game-page__hook">점메추천 SADARI 게임~!</h2>
      <p className="description game-page__intro">
        오늘 점심은 뭘 먹을지 모르겠다면, 취향을 고르고 사다리로 운명을 맡겨 보세요. MyG는{' '}
        <strong>내 위치 1km</strong>, 부족하면 <strong>BroG 2km</strong> 안에서 최대 {SADARI_SLOT_COUNT}곳을
        뽑습니다.
      </p>

      <div className="game-page__taste-block">
        <h3 className="game-page__taste-title">무슨 음식을 좋아하세요?</h3>
        <p className="muted game-page__taste-hint">
          고른 종류와 같은 카테고리(한식·중식 등) 매장을 같은 거리 조건 안에서 먼저 채웁니다.
        </p>
        <div className="game-page__taste-grid" role="group" aria-label="음식 취향">
          {BROG_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={'game-page__taste-btn' + (taste === cat ? ' game-page__taste-btn--active' : '')}
              onClick={() => setTaste(cat)}
            >
              {cat}
            </button>
          ))}
          <button
            type="button"
            className={'game-page__taste-btn game-page__taste-btn--any' + (taste === 'any' ? ' game-page__taste-btn--active' : '')}
            onClick={() => setTaste('any')}
          >
            상관없음
          </button>
        </div>
        {taste != null ? (
          <button type="button" className="compact-link game-page__taste-reset" onClick={() => setTaste(null)}>
            취향 다시 고르기
          </button>
        ) : null}
      </div>

      {geo.status === 'pending' ? (
        <p className="muted">위치 확인 중… 최대 약 1분까지 여러 번 시도합니다. 실내·Wi-Fi만 켠 경우 더 걸릴 수 있습니다.</p>
      ) : null}
      {geo.status === 'error' ? (
        <div className="game-page__geo-fallback">
          <div className="game-page__geo-error">
            <p className="error">{geo.message}</p>
            <button type="button" className="ghost-button" onClick={retryGeo}>
              위치 다시 시도
            </button>
          </div>
          <p className="muted game-page__manual-coords-intro">
            테스트·데스크톱에서는 아래 좌표로도 진행할 수 있습니다. (지도 페이지와 동일한 WGS84)
          </p>
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
                  placeholder="예: 37.56650"
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
                  placeholder="예: 126.97800"
                  aria-label="경도"
                />
              </label>
              <button type="button" className="home-hub__coord-apply" onClick={applyManualCoords}>
                좌표로 시작
              </button>
            </div>
            {manualCoordError ? <p className="error home-hub__coord-error">{manualCoordError}</p> : null}
            <button type="button" className="ghost-button game-page__demo-seoul" onClick={startWithDemoSeoul}>
              서울 시청 근처(데모)로 바로 시작
            </button>
          </div>
        </div>
      ) : null}

      {geo.status === 'ok' ? (
        <p className="muted game-page__geo-ok">
          기준 좌표: {geo.lat.toFixed(5)}, {geo.lng.toFixed(5)}
        </p>
      ) : null}

      {loadingPlaces ? <p>주변 맛집 불러오는 중…</p> : null}
      {loadError ? <p className="error">{loadError}</p> : null}

      {taste === null && geo.status === 'ok' && !loadingPlaces && !loadError ? (
        <p className="muted game-page__pick-first">위에서 취향을 골라 주세요. 그다음 사다리가 나옵니다.</p>
      ) : null}

      {candidates && !loadingPlaces ? (
        <LadderGame
          key={candidates.map((c) => c.key).join('-')}
          candidates={candidates}
          onWinnerPinRank={handleWinnerPinRank}
        />
      ) : null}

      {geo.status === 'ok' && KAKAO_MAP_APP_KEY ? (
        <section className="map-page-map-section map-card game-page__map-section">
          <h3 className="map-page-map-section__title">주변 지도</h3>
          <p className="map-page-map-section__hint">
            {candidates
              ? '사다리·상단 번호와 같은 숫자가 깃발에 표시됩니다. 점메추천 후 당첨 말풍선이 빨간색으로 바뀝니다. MyG·BroG 좌표가 있으면 표시됩니다.'
              : '취향을 고르기 전에는 2km 안 BroG 전체가 표시됩니다. 취향 선택 후에는 사다리 후보만 번호 깃발로 보입니다.'}
          </p>
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
          />
        </section>
      ) : null}
      {geo.status === 'ok' && !KAKAO_MAP_APP_KEY ? (
        <p className="muted game-page__map-fallback">
          지도를 쓰려면 <code>broke/.env</code>에 <code>VITE_KAKAO_MAP_APP_KEY</code>(JavaScript 키)를 설정하세요.
        </p>
      ) : null}
    </section>
  )
}
