import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { ACCESS_TOKEN_KEY, fetchMe, type User } from '../api/auth'
import { deleteRestaurant, fetchRestaurants, type RestaurantListItem } from '../api/restaurants'
import { KAKAO_MAP_APP_KEY } from '../api/config'
import { BrogKakaoMap } from '../components/BrogKakaoMap'
import { BrogRankCard } from '../components/BrogRankCard'
import { useSeoulMapUserLocation } from '../hooks/useSeoulMapUserLocation'
import {
  brogDistrictOptionsForUi,
  clampBrogDistrictForPhase1,
  isBrogPhase1Restricted,
} from '../lib/brogPhase1'
import { MAP_NEAR_RADIUS_M } from '../lib/mapConstants'
import { assumeAdminUi, canSoftDeleteBrogListing } from '../lib/roles'

const PRICE_FILTER_MAX_OPTIONS = [10000, 9000, 8000, 7000, 6000, 5000] as const

const DEFAULT_DISTRICT = '마포구'

export function MapPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const city = searchParams.get('city') ?? '서울특별시'
  const districtFromUrl = searchParams.get('district') ?? DEFAULT_DISTRICT

  const [district, setDistrictState] = useState(districtFromUrl)
  const [maxPrice, setMaxPrice] = useState(10000)
  const [restaurants, setRestaurants] = useState<RestaurantListItem[]>([])
  const [listError, setListError] = useState('')
  const [isListLoading, setIsListLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    setDistrictState(clampBrogDistrictForPhase1(districtFromUrl))
  }, [districtFromUrl])

  useEffect(() => {
    if (!isBrogPhase1Restricted()) return
    const next = clampBrogDistrictForPhase1(districtFromUrl)
    if (next !== districtFromUrl) {
      setSearchParams({ city, district: next }, { replace: true })
    }
  }, [city, districtFromUrl, setSearchParams])

  const setDistrict = useCallback(
    (gu: string) => {
      const next = clampBrogDistrictForPhase1(gu)
      setDistrictState(next)
      const c = searchParams.get('city') ?? '서울특별시'
      setSearchParams({ city: c, district: next }, { replace: true })
    },
    [searchParams, setSearchParams],
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

  const token = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null

  useEffect(() => {
    if (!token) {
      setUser(null)
      return
    }
    void fetchMe(token).then(setUser).catch(() => setUser(null))
  }, [token])

  function canDeleteRow(r: RestaurantListItem): boolean {
    return canSoftDeleteBrogListing(user, r)
  }

  async function handleSoftDelete(restaurant: RestaurantListItem) {
    if (!token) {
      window.alert(
        assumeAdminUi() ? '테스트 UI: 숨김은 로그인 후 API 호출이 필요합니다.' : '로그인 후 삭제할 수 있습니다.',
      )
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

    const base = { district, max_price: maxPrice } as const
    const params =
      mapUserCoords != null
        ? {
            ...base,
            near_lat: mapUserCoords.lat,
            near_lng: mapUserCoords.lng,
            radius_m: MAP_NEAR_RADIUS_M,
          }
        : base

    void fetchRestaurants(params)
      .then((data) => {
        if (!cancelled) {
          setRestaurants(data)
          setListError('')
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setRestaurants([])
          setListError(error instanceof Error ? error.message : '맛집 목록을 불러오지 못했습니다.')
        }
      })
      .finally(() => {
        if (!cancelled) setIsListLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [district, maxPrice, mapUserCoords])

  const pageTitle = `${district} BroG`
  const brogDistrictOptions = brogDistrictOptionsForUi()
  const mapMetaExtra = isBrogPhase1Restricted()
    ? ' 1단계: 지역은 마포·용산·서대문·영등포·종로·중구 6개 구만 선택할 수 있습니다.'
    : ''

  const pins = useMemo(
    () =>
      restaurants
        .filter((r) => r.latitude != null && r.longitude != null)
        .map((r, idx) => ({
          id: r.id,
          title: r.name,
          latitude: r.latitude as number,
          longitude: r.longitude as number,
          rank: idx + 1,
          markerKind: r.is_franchise ? ('franchise' as const) : ('brog' as const),
        })),
    [restaurants],
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
          <p className="eyebrow">BroG · 지도</p>
          <h2 className="brog-screen__title">{pageTitle}</h2>
          <p className="description map-hero__meta brog-screen__meta">
            {city} {district} · 대표 메뉴 {maxPrice.toLocaleString()}원 이하 · GPS·수동 좌표가 있으면 가까운 순(약 5km
            이내)으로 불러옵니다.
            {mapMetaExtra}
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
        <label className="price-filter map-page-toolbar__filter">
          서울시 구
          <select value={district} onChange={(e) => setDistrict(e.target.value)}>
            {brogDistrictOptions.map((gu) => (
              <option key={gu} value={gu}>
                {gu}
              </option>
            ))}
          </select>
        </label>
        <div className="map-page-toolbar__geo">
          <p className="helper" style={{ margin: '0 0 8px' }}>
            담당 권한이 있으면 아래 카드에서 바로 숨김 삭제할 수 있습니다.
          </p>
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
        {listError ? <p className="error">{listError}</p> : null}
        {isListLoading ? <p className="brog-rank-loading">맛집을 불러오는 중…</p> : null}

        {!isListLoading && restaurants.length === 0 && !listError ? (
          <article className="brog-rank-card brog-rank-card--empty">
            <p className="brog-rank-card__name brog-rank-card__name--primary">조건에 맞는 맛집이 없습니다</p>
            <p className="brog-rank-section__sub">가격·구·좌표 반경을 조정해 보세요.</p>
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
        <p className="map-page-map-section__hint">
          깃발 마커는 등록된 음식점 위치입니다. 클릭 시 상세로 이동합니다. 지도를 길게 누르거나 우클릭하면 그 지점을 내
          위치로 잡습니다.
        </p>
        {KAKAO_MAP_APP_KEY ? (
          <BrogKakaoMap
            userCoords={mapUserCoords}
            pins={pins}
            locating={geoBusy}
            onMyLocationClick={onMapLocate}
            onPickUserLocationOnMap={onPickUserLocationOnMap}
            getDetailPath={(id) => `/restaurants/${id}`}
            mapAriaLabel="BroG 위치 지도"
            shellClassName="kakao-map-embed"
            canvasClassName="kakao-map-container kakao-map-container--below"
          />
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
