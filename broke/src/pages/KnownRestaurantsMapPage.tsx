import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { KAKAO_MAP_APP_KEY } from '../api/config'
import { fetchKnownRestaurantPosts, type KnownRestaurantPost } from '../api/community'
import { BrogKakaoMap } from '../components/BrogKakaoMap'
import { useSeoulMapUserLocation } from '../hooks/useSeoulMapUserLocation'
import { haversineMeters } from '../lib/haversine'
import {
  clampStage1District,
  isStage1LimitedDistricts,
  mygDistrictOptionsForUi,
  STAGE1_DEFAULT_DISTRICT,
} from '../lib/deployStage1'

const DEFAULT_DISTRICT = STAGE1_DEFAULT_DISTRICT

export function KnownRestaurantsMapPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const districtFromUrl = searchParams.get('district') ?? DEFAULT_DISTRICT

  const [district, setDistrictState] = useState(districtFromUrl)
  const [posts, setPosts] = useState<KnownRestaurantPost[]>([])
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setDistrictState(clampStage1District(districtFromUrl))
  }, [districtFromUrl])

  useEffect(() => {
    if (!isStage1LimitedDistricts()) return
    const next = clampStage1District(districtFromUrl)
    if (next !== districtFromUrl) {
      setSearchParams({ district: next }, { replace: true })
    }
  }, [districtFromUrl, setSearchParams])

  const setDistrict = useCallback(
    (gu: string) => {
      const next = clampStage1District(gu)
      setDistrictState(next)
      setSearchParams({ district: next }, { replace: true })
    },
    [setSearchParams],
  )

  const {
    geoHint,
    geoBusy,
    setGeoRetryToken,
    mapUserCoords,
    latInput,
    setLatInput,
    lngInput,
    setLngInput,
    coordApplyError,
    handleApplyManualCoords,
    myLocationFromDevice,
    applyLatLng,
  } = useSeoulMapUserLocation(setDistrict)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')
    void fetchKnownRestaurantPosts()
      .then((rows) => {
        if (!cancelled) {
          setPosts(rows)
          setLoadError('')
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setPosts([])
          setLoadError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const inDistrict = useMemo(() => posts.filter((p) => p.district === district), [posts, district])

  const sortedForList = useMemo(() => {
    const withCoords = inDistrict.filter((p) => p.latitude != null && p.longitude != null)
    const without = inDistrict.filter((p) => p.latitude == null || p.longitude == null)
    if (!mapUserCoords) {
      return [...withCoords, ...without]
    }
    const ordered = [...withCoords].sort(
      (a, b) =>
        haversineMeters(mapUserCoords.lat, mapUserCoords.lng, a.latitude!, a.longitude!) -
        haversineMeters(mapUserCoords.lat, mapUserCoords.lng, b.latitude!, b.longitude!),
    )
    return [...ordered, ...without]
  }, [inDistrict, mapUserCoords])

  const pins = useMemo(
    () =>
      sortedForList
        .filter((p) => p.latitude != null && p.longitude != null)
        .map((p, idx) => ({
          id: p.id,
          title: p.restaurant_name || p.title,
          latitude: p.latitude as number,
          longitude: p.longitude as number,
          rank: idx + 1,
          markerKind: 'myg' as const,
        })),
    [sortedForList],
  )

  const onMapLocate = useCallback(() => {
    void myLocationFromDevice()
  }, [myLocationFromDevice])

  const onPickUserLocationOnMap = useCallback(
    (lat: number, lng: number) => {
      void applyLatLng(lat, lng)
    },
    [applyLatLng],
  )

  return (
    <div className="map-layout map-layout--brog brog-screen brog-screen--map">
      <section className="map-hero map-hero--compact brog-screen__header brog-screen__header--map">
        <div>
          <p className="eyebrow">MyG · 지도</p>
          <h2 className="brog-screen__title">{district} 제보</h2>
          <p className="description map-hero__meta brog-screen__meta">
            좌표가 있는 글만 지도에 표시됩니다. GPS·수동 좌표가 있으면 목록을 가까운 순으로 정렬합니다.
          </p>
        </div>
        <div className="hero-actions brog-screen__header-actions">
          <Link className="ghost-button" to="/">
            Home
          </Link>
          <Link className="ghost-button" to="/known-restaurants/list">
            목록
          </Link>
          <Link className="brog-screen__cta" to="/known-restaurants/write">
            글쓰기
          </Link>
        </div>
      </section>

      <div className="map-page-toolbar map-card">
        <label className="price-filter map-page-toolbar__filter">
          서울시 구
          <select value={district} onChange={(e) => setDistrict(e.target.value)}>
            {mygDistrictOptionsForUi().map((gu) => (
              <option key={gu} value={gu}>
                {gu}
              </option>
            ))}
          </select>
        </label>
        <div className="map-page-toolbar__geo">
          <p style={{ margin: '0 0 8px', fontSize: '0.9rem', color: '#8892a8' }}>
            {geoBusy ? `${geoHint} (최대 약 1분까지 시도 중…)` : geoHint}
            {navigator.geolocation ? (
              <>
                {' '}
                <button
                  type="button"
                  className="home-hub__geo-retry"
                  disabled={geoBusy}
                  onClick={() => setGeoRetryToken((t) => t + 1)}
                >
                  {geoBusy ? '위치 받는 중…' : '위치 다시 받기'}
                </button>
              </>
            ) : null}
          </p>
          <div
            className="home-hub__coord-edit map-page__coord-edit"
            aria-label="위도 경도 직접 입력"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void handleApplyManualCoords()
              }
            }}
          >
            <div className="home-hub__coord-row">
              <label className="home-hub__coord-field">
                위도
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  spellCheck={false}
                  className="home-hub__coord-input"
                  value={latInput}
                  onChange={(e) => setLatInput(e.target.value)}
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
                  value={lngInput}
                  onChange={(e) => setLngInput(e.target.value)}
                  placeholder="예: 126.97800"
                  aria-label="경도"
                />
              </label>
              <button type="button" className="home-hub__coord-apply" onClick={() => void handleApplyManualCoords()}>
                좌표 적용
              </button>
            </div>
            {coordApplyError ? <p className="error home-hub__coord-error">{coordApplyError}</p> : null}
          </div>
        </div>
      </div>

      <section className="home-section brog-rank-section">
        {loadError ? <p className="error">{loadError}</p> : null}
        {loading ? <p className="brog-rank-loading">불러오는 중…</p> : null}
        {!loading && sortedForList.length === 0 && !loadError ? (
          <article className="brog-rank-card brog-rank-card--empty">
            <p className="brog-rank-card__name brog-rank-card__name--primary">이 구에 표시할 글이 없습니다</p>
            <p className="brog-rank-section__sub">다른 구를 선택하거나 목록에서 글을 확인해 보세요.</p>
          </article>
        ) : (
          <ul className="myg-map-post-list">
            {sortedForList.map((post) => (
              <li key={post.id} className="myg-map-post-list__item">
                <Link to={`/known-restaurants/${post.id}`} className="compact-link">
                  {post.restaurant_name || post.title}
                </Link>
                <span className="myg-map-post-list__meta">
                  {post.main_menu_name}
                  {post.main_menu_price > 0 ? ` · ${post.main_menu_price.toLocaleString()}원` : ''}
                  {post.latitude != null && post.longitude != null && mapUserCoords
                    ? ` · 약 ${(haversineMeters(mapUserCoords.lat, mapUserCoords.lng, post.latitude, post.longitude) / 1000).toFixed(1)}km`
                    : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="map-page-map-section map-card">
        <h3 className="map-page-map-section__title">위치 지도</h3>
        <p className="map-page-map-section__hint">
          깃발은 좌표가 있는 MyG 글입니다. 클릭 시 상세로 이동합니다. 지도를 길게 누르거나 우클릭하면 그 지점을 내
          위치로 잡습니다.
        </p>
        {KAKAO_MAP_APP_KEY ? (
          <BrogKakaoMap
            userCoords={mapUserCoords}
            pins={pins}
            locating={geoBusy}
            onMyLocationClick={onMapLocate}
            onPickUserLocationOnMap={onPickUserLocationOnMap}
            getDetailPath={(id) => `/known-restaurants/${id}`}
            mapAriaLabel="MyG 위치 지도"
            shellClassName="kakao-map-embed"
            canvasClassName="kakao-map-container kakao-map-container--below"
          />
        ) : (
          <>
            <p className="muted">
              <code>broke/.env</code>의 <code>VITE_KAKAO_MAP_APP_KEY</code>(JavaScript 키)를 설정하면 지도가 표시됩니다.
            </p>
            <div className="placeholder-box">MAP</div>
          </>
        )}
      </section>
    </div>
  )
}
