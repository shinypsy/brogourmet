import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { ACCESS_TOKEN_KEY, fetchMe, type User } from '../api/auth'
import {
  clearBroListPin,
  cycleBroListPin,
  deleteRestaurant,
  fetchRestaurants,
  type RestaurantListItem,
} from '../api/restaurants'
import { KAKAO_MAP_APP_KEY, KAKAO_REST_API_KEY } from '../api/config'
import { BrogKakaoMap } from './BrogKakaoMap'
import { MapPageBrogImageGridList } from './MapPageBrogImageGridList'
import { useSeoulMapUserLocation } from '../hooks/useSeoulMapUserLocation'
import {
  BROG_DISTRICT_ALL,
  brogDistrictOptionsForUi,
  clampBrogDistrictForPhase1,
  parseBrogDistrictUrlParam,
} from '../lib/brogPhase1'
import { brogMygMapSectionHint } from '../lib/brogMygTwin'
import { fetchKakaoKeywordFirstPlace } from '../lib/kakaoKeywordSearch'
import { restaurantMatchesBroMapSearch } from '../lib/mapBroSearch'
import { MAP_NEAR_RADIUS_M } from '../lib/mapConstants'
import { BROG_MAIN_MENU_PRICE_MAX_OPTIONS } from '../lib/mainMenuPriceMaxFilterOptions'
import { assumeAdminUi, canManageBrogForDistrict, canSoftDeleteBrogListing } from '../lib/roles'

export type MapPageBodyProps = {
  /** true: `/map` — 구를 URL `district`와 동기화 */
  syncDistrictToSearchParams: boolean
  /** 홈: 이미지 그리드 / 지도 페이지: 한 줄 텍스트 */
  listPresentation?: 'textLines' | 'imageGrid'
  /** 설정 시 목록 API에 `limit` 전달(예: 홈 8건). */
  listFetchLimit?: number
  /** true: 지도 깃발에 상호 말풍선 표시(`/map` 등). 홈 지도는 false 유지. */
  mapSpeechBubbles?: boolean
}

export function MapPageBody({
  syncDistrictToSearchParams,
  listPresentation = 'textLines',
  listFetchLimit,
  mapSpeechBubbles = false,
}: MapPageBodyProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const city = searchParams.get('city') ?? '서울특별시'
  const districtUrlRaw = searchParams.get('district')
  const districtFromCanonical = clampBrogDistrictForPhase1(parseBrogDistrictUrlParam(districtUrlRaw))

  const [district, setDistrictState] = useState(() =>
    clampBrogDistrictForPhase1(
      syncDistrictToSearchParams && typeof window !== 'undefined'
        ? parseBrogDistrictUrlParam(new URLSearchParams(window.location.search).get('district'))
        : BROG_DISTRICT_ALL,
    ),
  )
  const [maxPrice, setMaxPrice] = useState(10000)
  const [restaurants, setRestaurants] = useState<RestaurantListItem[]>([])
  const [listError, setListError] = useState('')
  const [isListLoading, setIsListLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [listReloadTick, setListReloadTick] = useState(0)
  const [pinBusyId, setPinBusyId] = useState<number | null>(null)
  const [nearIgnoreDistrict, setNearIgnoreDistrict] = useState(false)
  const [mapBroSearchQuery, setMapBroSearchQuery] = useState('')
  const [mapPlaceQuery, setMapPlaceQuery] = useState('')
  const [placeSearchBusy, setPlaceSearchBusy] = useState(false)
  const [placeSearchHint, setPlaceSearchHint] = useState('')

  useEffect(() => {
    if (!syncDistrictToSearchParams) return
    setDistrictState(districtFromCanonical)
  }, [districtFromCanonical, syncDistrictToSearchParams])

  useEffect(() => {
    if (!syncDistrictToSearchParams) return
    if ((districtUrlRaw ?? '') !== districtFromCanonical) {
      setSearchParams({ city, district: districtFromCanonical }, { replace: true })
    }
  }, [city, districtUrlRaw, districtFromCanonical, setSearchParams, syncDistrictToSearchParams])

  const setDistrict = useCallback(
    (gu: string) => {
      const next = clampBrogDistrictForPhase1(gu)
      setDistrictState(next)
      if (syncDistrictToSearchParams) {
        const c = searchParams.get('city') ?? '서울특별시'
        setSearchParams({ city: c, district: next }, { replace: true })
      }
    },
    [searchParams, setSearchParams, syncDistrictToSearchParams],
  )

  const {
    geoBusy,
    mapUserCoords,
    latInput,
    setLatInput,
    lngInput,
    setLngInput,
    coordApplyError,
    handleApplyManualCoords,
    myLocationFromDevice,
    applyLatLng,
  } = useSeoulMapUserLocation(setDistrict, {
    initialGeolocationSetsDistrict: false,
    onApplyLatLngResolved: (r) => setNearIgnoreDistrict(r.reason !== 'ok'),
    onDeviceCoordsWithoutDistrictSync: () => setNearIgnoreDistrict(true),
  })

  const nearLat = mapUserCoords?.lat ?? null
  const nearLng = mapUserCoords?.lng ?? null

  const token =
    typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY)?.trim() || null : null

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

  function canPinRow(r: RestaurantListItem): boolean {
    if (!token || !user) return false
    if (assumeAdminUi()) return true
    return canManageBrogForDistrict(user.role, user.managed_district_id, r.district_id)
  }

  async function handleCycleListPin(restaurantId: number) {
    if (!token) {
      window.alert('로그인 후 이용할 수 있습니다.')
      return
    }
    setPinBusyId(restaurantId)
    try {
      await cycleBroListPin(token, restaurantId)
      setListReloadTick((t) => t + 1)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '고정 설정에 실패했습니다.')
    } finally {
      setPinBusyId(null)
    }
  }

  async function handleClearListPin(restaurantId: number) {
    if (!token) {
      window.alert('로그인 후 이용할 수 있습니다.')
      return
    }
    setPinBusyId(restaurantId)
    try {
      await clearBroListPin(token, restaurantId)
      setListReloadTick((t) => t + 1)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '고정 해제에 실패했습니다.')
    } finally {
      setPinBusyId(null)
    }
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

    const base = {
      ...(district !== BROG_DISTRICT_ALL ? { district } : {}),
      max_price: maxPrice,
    } as const
    const useNearForListApi =
      nearIgnoreDistrict && nearLat != null && nearLng != null
    const params = useNearForListApi
      ? {
          ...base,
          near_lat: nearLat,
          near_lng: nearLng,
          radius_m: MAP_NEAR_RADIUS_M,
          near_ignore_district: true as const,
          ...(listFetchLimit != null ? { limit: listFetchLimit } : {}),
        }
      : { ...base, ...(listFetchLimit != null ? { limit: listFetchLimit } : {}) }

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
  }, [district, maxPrice, nearLat, nearLng, nearIgnoreDistrict, listReloadTick, listFetchLimit])

  const visibleRestaurants = useMemo(
    () => restaurants.filter((r) => restaurantMatchesBroMapSearch(r, mapBroSearchQuery)),
    [restaurants, mapBroSearchQuery],
  )

  const broSearchTrimmed = mapBroSearchQuery.trim()

  const handlePlaceSearchSubmit = useCallback(async () => {
    const q = mapPlaceQuery.trim()
    if (!q) {
      setPlaceSearchHint('검색할 장소나 지명을 입력해 주세요.')
      return
    }
    if (!KAKAO_REST_API_KEY.trim()) {
      setPlaceSearchHint('장소 검색에는 broke/.env 의 VITE_KAKAO_REST_API_KEY 가 필요합니다.')
      return
    }
    setPlaceSearchBusy(true)
    setPlaceSearchHint('')
    try {
      const p = await fetchKakaoKeywordFirstPlace(q)
      if (!p) {
        setPlaceSearchHint('일치하는 장소를 찾지 못했습니다. 다른 표현으로 시도해 보세요.')
        return
      }
      await applyLatLng(p.lat, p.lng)
      setPlaceSearchHint(`「${p.placeName}」 근처로 맞췄습니다. 아래 목록이 반경 기준으로 다시 불러와집니다.`)
    } catch (e) {
      setPlaceSearchHint(e instanceof Error ? e.message : '장소 검색에 실패했습니다.')
    } finally {
      setPlaceSearchBusy(false)
    }
  }, [applyLatLng, mapPlaceQuery])

  const brogDistrictOptions = brogDistrictOptionsForUi()

  const pins = useMemo(
    () =>
      visibleRestaurants
        .filter((r) => r.latitude != null && r.longitude != null)
        .map((r, idx) => ({
          id: r.id,
          title: r.name,
          mapSpeechLabel: r.name,
          latitude: r.latitude as number,
          longitude: r.longitude as number,
          rank: idx + 1,
          markerKind: r.is_franchise ? ('franchise' as const) : ('brog' as const),
        })),
    [visibleRestaurants],
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

  const listTitle = listPresentation === 'imageGrid' ? '목록 · 이미지' : '목록'

  return (
    <div className="map-layout map-layout--brog brog-screen brog-screen--map">
      <div className="map-page-toolbar map-card">
        <div className="map-page-toolbar__filters-row">
          <label className="price-filter map-page-toolbar__filter">
            가격 상한
            <select value={maxPrice} onChange={(event) => setMaxPrice(Number(event.target.value))}>
              {BROG_MAIN_MENU_PRICE_MAX_OPTIONS.map((price) => (
                <option key={price} value={price}>
                  {price.toLocaleString()}원 이하
                </option>
              ))}
            </select>
          </label>
          <label className="price-filter map-page-toolbar__filter">
            서울시
            <select
              value={district}
              onChange={(e) => {
                setNearIgnoreDistrict(false)
                setDistrict(e.target.value)
              }}
            >
              {brogDistrictOptions.map((gu) => (
                <option key={gu} value={gu}>
                  {gu}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="map-page-toolbar__geo">
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
            <div className="home-hub__coord-row map-page-toolbar__coord-row">
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
              {navigator.geolocation ? (
                <button
                  type="button"
                  className="map-page-toolbar__geo-icon-btn"
                  disabled={geoBusy}
                  title="위치 다시 받기"
                  aria-label={geoBusy ? '위치 받는 중' : '위치 다시 받기'}
                  onClick={() => void myLocationFromDevice()}
                >
                  <span className="map-page-toolbar__geo-icon-btn-inner" aria-hidden>
                    {geoBusy ? (
                      <svg width="22" height="22" viewBox="0 0 24 24" className="map-page-toolbar__geo-spinner">
                        <circle
                          cx="12"
                          cy="12"
                          r="9"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeDasharray="42"
                          strokeLinecap="round"
                          opacity="0.35"
                        />
                        <path
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          d="M12 3a9 9 0 0 1 9 9"
                        />
                      </svg>
                    ) : (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" />
                        <path
                          strokeLinecap="round"
                          d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
                        />
                      </svg>
                    )}
                  </span>
                </button>
              ) : null}
            </div>
            {coordApplyError ? <p className="error home-hub__coord-error">{coordApplyError}</p> : null}
          </div>
        </div>
      </div>

      <section className="map-page-map-section map-card">
        <h3 className="map-page-map-section__title">위치 지도</h3>
        <p className="map-page-map-section__hint">{brogMygMapSectionHint(false)}</p>
        <div className="map-page-map-search map-page-map-search--dual" aria-label="BroG 지도 검색">
          <div className="map-page-map-search__field map-page-map-search__field--place">
            <span className="map-page-map-search__label-text">장소·지명</span>
            <div className="map-page-map-search__row">
              <input
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                spellCheck={false}
                className="map-page-map-search__input"
                placeholder="예: 홍대입구역, 망원동, 테헤란로"
                value={mapPlaceQuery}
                disabled={placeSearchBusy}
                onChange={(e) => {
                  setMapPlaceQuery(e.target.value)
                  if (placeSearchHint) setPlaceSearchHint('')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void handlePlaceSearchSubmit()
                  }
                }}
                aria-label="장소 또는 지명 검색"
              />
              <button
                type="button"
                className="map-page-map-search__action"
                disabled={placeSearchBusy || !mapPlaceQuery.trim() || !KAKAO_REST_API_KEY.trim()}
                onClick={() => void handlePlaceSearchSubmit()}
              >
                {placeSearchBusy ? '찾는 중…' : '이 위치로'}
              </button>
            </div>
            {!KAKAO_REST_API_KEY.trim() ? (
              <p className="map-page-map-search__helper map-page-map-search__helper--warn">
                장소 검색: <code>VITE_KAKAO_REST_API_KEY</code>를 넣으면 카카오 키워드 검색으로 이동할 수 있습니다.
              </p>
            ) : null}
            {placeSearchHint ? (
              <p
                className={
                  placeSearchHint.includes('실패') ||
                  placeSearchHint.includes('못했') ||
                  placeSearchHint.includes('필요') ||
                  placeSearchHint.includes('확인') ||
                  placeSearchHint.includes('못 찾')
                    ? 'map-page-map-search__helper map-page-map-search__helper--warn'
                    : 'map-page-map-search__helper map-page-map-search__helper--ok'
                }
              >
                {placeSearchHint.includes('맞췄습니다') ? (
                  <span className="map-page-map-search__hint-ok-icon" aria-hidden>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                ) : null}
                {placeSearchHint}
              </p>
            ) : null}
          </div>
          <div className="map-page-map-search__field map-page-map-search__field--bro">
            <div className="map-page-map-search__label-row">
              <span className="map-page-map-search__label-text">BroG 글 검색</span>
              {broSearchTrimmed ? (
                <span
                  className={
                    visibleRestaurants.length > 0
                      ? 'map-page-map-search__bro-badge map-page-map-search__bro-badge--ok'
                      : restaurants.length > 0
                        ? 'map-page-map-search__bro-badge map-page-map-search__bro-badge--warn'
                        : 'map-page-map-search__bro-badge'
                  }
                  title="현재 불러온 목록 기준 필터 결과(공백 무시·토큰 AND)"
                >
                  {visibleRestaurants.length > 0 ? (
                    <svg
                      className="map-page-map-search__status-icon"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : (
                    <svg
                      className="map-page-map-search__status-icon"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <circle cx="12" cy="12" r="9" />
                      <path d="M8 8l8 8M16 8l-8 8" />
                    </svg>
                  )}
                  {visibleRestaurants.length > 0
                    ? `${visibleRestaurants.length}곳 일치`
                    : restaurants.length > 0
                      ? '일치 없음'
                      : '목록 없음'}
                </span>
              ) : null}
            </div>
            <div className="map-page-map-search__row">
              <input
                type="text"
                enterKeyHint="search"
                autoComplete="off"
                spellCheck={false}
                className="map-page-map-search__input map-page-map-search__input--bro"
                placeholder="상호·닉네임·메뉴·소개·구·시 — 공백으로 AND(상호 내 공백 무시)"
                value={mapBroSearchQuery}
                onChange={(e) => setMapBroSearchQuery(e.target.value)}
                aria-label="BroG 상호·등록자 닉네임·메뉴·소개 검색"
              />
              {broSearchTrimmed ? (
                <button
                  type="button"
                  className="map-page-map-search__clear map-page-map-search__clear--inline"
                  onClick={() => setMapBroSearchQuery('')}
                >
                  지우기
                </button>
              ) : null}
            </div>
          </div>
        </div>
        {KAKAO_MAP_APP_KEY ? (
          <BrogKakaoMap
            userCoords={mapUserCoords}
            pins={pins}
            locating={geoBusy}
            onMyLocationClick={onMapLocate}
            onPickUserLocationOnMap={onPickUserLocationOnMap}
            autoRefitWhenPinsChange={false}
            getDetailPath={(id) => `/restaurants/${id}`}
            mapAriaLabel="BroG 위치 지도"
            shellClassName="kakao-map-embed"
            canvasClassName="kakao-map-container kakao-map-container--below"
            mapSpeechBubbles={mapSpeechBubbles}
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

      <section className="home-section map-page-brog-list-section" aria-label="BroG 목록">
        <h3 className="map-page-brog-list-section__title">{listTitle}</h3>
        {listError ? <p className="error">{listError}</p> : null}
        {isListLoading ? <p className="helper map-page-brog-list-section__loading">맛집을 불러오는 중…</p> : null}

        {!isListLoading && restaurants.length === 0 && !listError ? (
          <p className="helper map-page-brog-list-section__empty">
            조건에 맞는 맛집이 없습니다. 가격·구·좌표 반경을 조정해 보세요.
          </p>
        ) : !isListLoading && restaurants.length > 0 && visibleRestaurants.length === 0 && !listError ? (
          <p className="helper map-page-brog-list-section__empty">
            지도 검색어와 맞는 BroG가 없습니다. BroG 키워드 검색을 비우거나 장소 검색으로 다른 곳을 기준으로 불러와 보세요.
          </p>
        ) : listPresentation === 'imageGrid' ? (
          <MapPageBrogImageGridList
            items={visibleRestaurants}
            getDetailHref={(r) => `/restaurants/${r.id}`}
            getRankDisplay={(r, index) => {
              const pin = r.bro_list_pin
              return pin != null && pin >= 1 && pin <= 4 ? pin : index + 1
            }}
            showBroListPinMeta
            renderActions={(restaurant) =>
              canPinRow(restaurant) || canDeleteRow(restaurant) ? (
                <>
                  {canPinRow(restaurant) ? (
                    <>
                      <button
                        type="button"
                        className="map-page-brog-lines__action-btn"
                        disabled={pinBusyId === restaurant.id}
                        title="미고정: 구 내 빈 슬롯(1~4) 부여 · 고정됨: 다음 슬롯 순환"
                        onClick={(e) => {
                          e.preventDefault()
                          void handleCycleListPin(restaurant.id)
                        }}
                      >
                        {pinBusyId === restaurant.id
                          ? '…'
                          : restaurant.bro_list_pin == null
                            ? '고정'
                            : `${restaurant.bro_list_pin}위→`}
                      </button>
                      {restaurant.bro_list_pin != null ? (
                        <button
                          type="button"
                          className="map-page-brog-lines__action-btn"
                          disabled={pinBusyId === restaurant.id}
                          title="이 맛집만 고정 해제"
                          onClick={(e) => {
                            e.preventDefault()
                            void handleClearListPin(restaurant.id)
                          }}
                        >
                          해제
                        </button>
                      ) : null}
                    </>
                  ) : null}
                  {canDeleteRow(restaurant) ? (
                    <button
                      type="button"
                      className="map-page-brog-lines__action-btn map-page-brog-lines__action-btn--danger"
                      onClick={(e) => {
                        e.preventDefault()
                        void handleSoftDelete(restaurant)
                      }}
                    >
                      숨김
                    </button>
                  ) : null}
                </>
              ) : null
            }
          />
        ) : (
          <ul className="map-page-brog-lines">
            {visibleRestaurants.map((restaurant, index) => {
              const pin = restaurant.bro_list_pin
              const displayRank =
                pin != null && pin >= 1 && pin <= 4 ? pin : index + 1
              const priceStr = restaurant.main_menu_price
                ? `${restaurant.main_menu_price.toLocaleString()}원`
                : ''
              const menuPart = [restaurant.main_menu_name, priceStr].filter(Boolean).join(' ')
              const menuBit = menuPart ? ` · ${menuPart}` : ''
              return (
                <li key={restaurant.id} className="map-page-brog-lines__item">
                  <div className="map-page-brog-lines__row">
                    <span className="map-page-brog-lines__rank" aria-hidden>
                      {displayRank}.
                    </span>
                    <Link
                      to={`/restaurants/${restaurant.id}`}
                      className={
                        restaurant.points_eligible !== false
                          ? 'map-page-brog-lines__name'
                          : 'map-page-brog-lines__name map-page-brog-lines__name--secondary'
                      }
                    >
                      {restaurant.name}
                    </Link>
                    <span className="map-page-brog-lines__text">
                      {' '}
                      · {restaurant.district} · {restaurant.category}
                      {menuBit}
                      {pin != null && pin >= 1 && pin <= 4 ? (
                        <span className="map-page-brog-lines__tag" title={`관리자 고정 ${pin}위`}>
                          {' '}
                          고정{pin}
                        </span>
                      ) : null}
                      {restaurant.has_active_site_event ? (
                        <span className="map-page-brog-lines__tag map-page-brog-lines__tag--event"> 이벤트</span>
                      ) : null}
                      {restaurant.is_franchise ? (
                        <span className="map-page-brog-lines__tag map-page-brog-lines__tag--franchise"> 가맹</span>
                      ) : null}
                    </span>
                    {canPinRow(restaurant) || canDeleteRow(restaurant) ? (
                      <span className="map-page-brog-lines__actions">
                        {canPinRow(restaurant) ? (
                          <>
                            <button
                              type="button"
                              className="map-page-brog-lines__action-btn"
                              disabled={pinBusyId === restaurant.id}
                              title="미고정: 구 내 빈 슬롯(1~4) 부여 · 고정됨: 다음 슬롯 순환"
                              onClick={() => void handleCycleListPin(restaurant.id)}
                            >
                              {pinBusyId === restaurant.id
                                ? '…'
                                : restaurant.bro_list_pin == null
                                  ? '고정'
                                  : `${restaurant.bro_list_pin}위→`}
                            </button>
                            {restaurant.bro_list_pin != null ? (
                              <button
                                type="button"
                                className="map-page-brog-lines__action-btn"
                                disabled={pinBusyId === restaurant.id}
                                title="이 맛집만 고정 해제"
                                onClick={() => void handleClearListPin(restaurant.id)}
                              >
                                해제
                              </button>
                            ) : null}
                          </>
                        ) : null}
                        {canDeleteRow(restaurant) ? (
                          <button
                            type="button"
                            className="map-page-brog-lines__action-btn map-page-brog-lines__action-btn--danger"
                            onClick={() => void handleSoftDelete(restaurant)}
                          >
                            숨김
                          </button>
                        ) : null}
                      </span>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
