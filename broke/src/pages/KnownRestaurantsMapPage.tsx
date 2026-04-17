import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { ACCESS_TOKEN_KEY, fetchMe, type User } from '../api/auth'
import { AUTH_CHANGE_EVENT } from '../authEvents'
import {
  deleteKnownRestaurantPost,
  fetchKnownRestaurantPosts,
  type KnownRestaurantPost,
} from '../api/community'
import { KAKAO_MAP_APP_KEY, KAKAO_REST_API_KEY } from '../api/config'
import type { RestaurantListItem } from '../api/restaurants'
import { BrogKakaoMap } from '../components/BrogKakaoMap'
import { HomeStyleListToolbarGeo } from '../components/HomeStyleListSearchBlocks'
import { useSeoulMapUserLocation } from '../hooks/useSeoulMapUserLocation'
import { haversineMeters } from '../lib/haversine'
import {
  BROG_DISTRICT_ALL,
  clampStage1District,
  mygDistrictOptionsForUi,
  parseBrogDistrictUrlParam,
} from '../lib/deployStage1'
import { fetchKakaoKeywordFirstPlace } from '../lib/kakaoKeywordSearch'
import { knownRestaurantPostMatchesMygMapSearch } from '../lib/mapBroSearch'
import { MAP_NEAR_RADIUS_M } from '../lib/mapConstants'
import { MYG_MAIN_MENU_PRICE_MAX_OPTIONS } from '../lib/mainMenuPriceMaxFilterOptions'
import { mygPostToRestaurantListItem } from '../lib/mygPostToRestaurantListItem'
import { canDeleteKnownRestaurantPost } from '../lib/roles'

export function KnownRestaurantsMapPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const districtUrlRaw = searchParams.get('district')
  const districtFromUrl = parseBrogDistrictUrlParam(districtUrlRaw)

  const [district, setDistrictState] = useState(() =>
    clampStage1District(
      typeof window !== 'undefined'
        ? parseBrogDistrictUrlParam(new URLSearchParams(window.location.search).get('district'))
        : districtFromUrl,
    ),
  )
  const [maxPrice, setMaxPrice] = useState(10000)
  const [posts, setPosts] = useState<KnownRestaurantPost[]>([])
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  /** BroG 지도와 동일: 좌표가 구와 어긋나면 반경 모드 */
  const [nearIgnoreDistrict, setNearIgnoreDistrict] = useState(false)
  const [mapExploreCenter, setMapExploreCenter] = useState<{ lat: number; lng: number } | null>(null)
  const nearIgnoreDistrictRef = useRef(false)
  nearIgnoreDistrictRef.current = nearIgnoreDistrict
  const [mapMygSearchQuery, setMapMygSearchQuery] = useState('')
  const [mapPlaceQuery, setMapPlaceQuery] = useState('')
  const [placeSearchBusy, setPlaceSearchBusy] = useState(false)
  const [placeSearchHint, setPlaceSearchHint] = useState('')
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    setDistrictState(clampStage1District(districtFromUrl))
  }, [districtFromUrl])

  useEffect(() => {
    const next = clampStage1District(districtFromUrl)
    if ((districtUrlRaw ?? '') !== next) {
      setSearchParams({ district: next }, { replace: true })
    }
  }, [districtFromUrl, districtUrlRaw, setSearchParams])

  const setDistrict = useCallback(
    (gu: string) => {
      const next = clampStage1District(gu)
      setDistrictState(next)
      setSearchParams({ district: next }, { replace: true })
    },
    [setSearchParams],
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
    onApplyLatLngResolved: () => setNearIgnoreDistrict(true),
    onDeviceCoordsWithoutDistrictSync: () => setNearIgnoreDistrict(true),
  })

  const mapUserLat = mapUserCoords?.lat
  const mapUserLng = mapUserCoords?.lng

  useEffect(() => {
    setMapExploreCenter(null)
  }, [district, mapUserLat, mapUserLng])

  const onMapViewSettled = useCallback((lat: number, lng: number) => {
    if (!nearIgnoreDistrictRef.current) return
    setMapExploreCenter({ lat, lng })
  }, [])

  const reloadPosts = useCallback(() => {
    setLoading(true)
    setLoadError('')
    const t = localStorage.getItem(ACCESS_TOKEN_KEY)
    return fetchKnownRestaurantPosts(t)
      .then((rows) => {
        setPosts(rows)
        setLoadError('')
      })
      .catch((e) => {
        setPosts([])
        setLoadError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.')
      })
      .finally(() => {
        setLoading(false)
        const tok = localStorage.getItem(ACCESS_TOKEN_KEY)
        if (tok?.trim()) void fetchMe(tok).then(setUser).catch(() => setUser(null))
        else setUser(null)
      })
  }, [])

  useEffect(() => {
    void reloadPosts()
  }, [reloadPosts])

  useEffect(() => {
    function onAuth() {
      void reloadPosts()
    }
    function onStorage(e: StorageEvent) {
      if (e.key === ACCESS_TOKEN_KEY) void reloadPosts()
    }
    window.addEventListener(AUTH_CHANGE_EVENT, onAuth)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, onAuth)
      window.removeEventListener('storage', onStorage)
    }
  }, [reloadPosts])

  async function handleDeletePost(postId: number) {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY)
    if (!token) return
    if (!window.confirm('이 글을 삭제할까요?')) return
    try {
      await deleteKnownRestaurantPost(token, postId)
      await reloadPosts()
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '삭제에 실패했습니다.')
    }
  }

  const hasUserCoords = mapUserCoords != null
  const useNearListMode = nearIgnoreDistrict && hasUserCoords

  const postsForListSource = useMemo(() => {
    if (useNearListMode) {
      return posts.filter((p) => p.latitude != null && p.longitude != null)
    }
    if (district === BROG_DISTRICT_ALL) return posts
    return posts.filter((p) => p.district === district)
  }, [posts, district, useNearListMode])

  /** BroG 지도와 동일 가격 상한 UI — MyG는 API가 아니라 대표 메뉴 가격으로 클라이언트 필터 */
  const postsMatchingPrice = useMemo(
    () => postsForListSource.filter((p) => Number(p.main_menu_price) <= maxPrice),
    [postsForListSource, maxPrice],
  )

  const sortedForList = useMemo(() => {
    if (!useNearListMode) {
      const withCoords = postsMatchingPrice.filter((p) => p.latitude != null && p.longitude != null)
      const without = postsMatchingPrice.filter((p) => p.latitude == null || p.longitude == null)
      return [...withCoords, ...without]
    }
    const withCoords = postsMatchingPrice.filter((p) => p.latitude != null && p.longitude != null)
    const origin = mapExploreCenter ?? mapUserCoords!
    const { lat, lng } = origin
    const inRadius = withCoords.filter(
      (p) => haversineMeters(lat, lng, p.latitude!, p.longitude!) <= MAP_NEAR_RADIUS_M,
    )
    return [...inRadius].sort(
      (a, b) =>
        haversineMeters(lat, lng, a.latitude!, a.longitude!) -
        haversineMeters(lat, lng, b.latitude!, b.longitude!),
    )
  }, [postsMatchingPrice, mapUserCoords, mapExploreCenter, useNearListMode])

  const visiblePosts = useMemo(
    () => sortedForList.filter((p) => knownRestaurantPostMatchesMygMapSearch(p, mapMygSearchQuery)),
    [sortedForList, mapMygSearchQuery],
  )

  const visibleListRows = useMemo(() => visiblePosts.map(mygPostToRestaurantListItem), [visiblePosts])

  const mygSearchTrimmed = mapMygSearchQuery.trim()

  function canDeleteMygRow(r: RestaurantListItem): boolean {
    return Boolean(
      user &&
        r.submitted_by_user_id != null &&
        canDeleteKnownRestaurantPost(user, r.submitted_by_user_id, r.district),
    )
  }

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

  const pins = useMemo(
    () =>
      visiblePosts
        .filter((p) => p.latitude != null && p.longitude != null)
        .map((p, idx) => {
          const label = (p.restaurant_name || p.title || '').trim()
          return {
            id: p.id,
            title: label || `글 ${p.id}`,
            mapSpeechLabel: label,
            latitude: p.latitude as number,
            longitude: p.longitude as number,
            rank: idx + 1,
            markerKind: 'myg' as const,
          }
        }),
    [visiblePosts],
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

  const mygDistrictOptions = mygDistrictOptionsForUi()

  return (
    <div className="home-layout home-layout--hub home-layout--map-home">
    <div className="map-layout map-layout--brog brog-screen brog-screen--map">
      <div className="map-page-toolbar map-card">
        <div className="map-page-toolbar__filters-row">
          <label className="price-filter map-page-toolbar__filter">
            가격 상한
            <select value={maxPrice} onChange={(event) => setMaxPrice(Number(event.target.value))}>
              {MYG_MAIN_MENU_PRICE_MAX_OPTIONS.map((price) => (
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
                setMapExploreCenter(null)
                setDistrict(e.target.value)
              }}
            >
              {mygDistrictOptions.map((gu) => (
                <option key={gu} value={gu}>
                  {gu}
                </option>
              ))}
            </select>
          </label>
        </div>
        <HomeStyleListToolbarGeo
          latInput={latInput}
          setLatInput={setLatInput}
          lngInput={lngInput}
          setLngInput={setLngInput}
          coordApplyError={coordApplyError}
          handleApplyManualCoords={handleApplyManualCoords}
          geoBusy={geoBusy}
          myLocationFromDevice={myLocationFromDevice}
        />
      </div>

      <section className="map-page-map-section map-card">
        <h3 className="map-page-map-section__title">위치 지도</h3>
        <div className="map-page-map-search map-page-map-search--dual" aria-label="MyG 지도 검색">
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
              <span className="map-page-map-search__label-text">MyG 글 검색</span>
              {mygSearchTrimmed ? (
                <span
                  className={
                    visiblePosts.length > 0
                      ? 'map-page-map-search__bro-badge map-page-map-search__bro-badge--ok'
                      : sortedForList.length > 0
                        ? 'map-page-map-search__bro-badge map-page-map-search__bro-badge--warn'
                        : 'map-page-map-search__bro-badge'
                  }
                  title="현재 불러온 목록 기준 필터 결과(공백 무시·토큰 AND)"
                >
                  {visiblePosts.length > 0 ? (
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
                  {visiblePosts.length > 0
                    ? `${visiblePosts.length}곳 일치`
                    : sortedForList.length > 0
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
                placeholder="상호·제목·본문·닉네임·메뉴·구·시 — 공백으로 AND"
                value={mapMygSearchQuery}
                onChange={(e) => setMapMygSearchQuery(e.target.value)}
                aria-label="MyG 상호·제목·본문·작성자 검색"
              />
              {mygSearchTrimmed ? (
                <button
                  type="button"
                  className="map-page-map-search__clear map-page-map-search__clear--inline"
                  onClick={() => setMapMygSearchQuery('')}
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
            onMapViewSettled={onMapViewSettled}
            autoRefitWhenPinsChange={false}
            getDetailPath={(id) => `/known-restaurants/${id}`}
            mapSpeechBubbles
            mapAriaLabel="MyG 위치 지도"
            shellClassName="kakao-map-embed"
            canvasClassName="kakao-map-container kakao-map-container--below"
            showInteractionHints={false}
          />
        ) : (
          <div className="placeholder-box">MAP</div>
        )}
      </section>

      <section className="home-section map-page-brog-list-section" aria-label="MyG 목록">
        <h3 className="map-page-brog-list-section__title">목록</h3>
        {loadError ? <p className="error">{loadError}</p> : null}
        {loading ? <p className="helper map-page-brog-list-section__loading">목록을 불러오는 중…</p> : null}

        {!loading && sortedForList.length === 0 && !loadError ? (
          <p className="helper map-page-brog-list-section__empty">
            조건에 맞는 MyG 글이 없습니다. 가격·구·좌표 반경을 조정해 보세요.
          </p>
        ) : !loading && sortedForList.length > 0 && visiblePosts.length === 0 && !loadError ? (
          <p className="helper map-page-brog-list-section__empty">
            지도 검색어와 맞는 MyG 글이 없습니다. MyG 글 검색을 비우거나 장소 검색으로 다른 곳을 기준으로 불러와 보세요.
          </p>
        ) : !loading && visibleListRows.length > 0 && !loadError ? (
          <ul className="map-page-brog-lines">
            {visibleListRows.map((restaurant, index) => {
              const displayRank = index + 1
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
                      to={`/known-restaurants/${restaurant.id}`}
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
                      {restaurant.has_active_site_event ? (
                        <span className="map-page-brog-lines__tag map-page-brog-lines__tag--event"> 이벤트</span>
                      ) : null}
                      {restaurant.is_franchise ? (
                        <span className="map-page-brog-lines__tag map-page-brog-lines__tag--franchise"> 가맹</span>
                      ) : null}
                    </span>
                    {canDeleteMygRow(restaurant) ? (
                      <span className="map-page-brog-lines__actions">
                        <button
                          type="button"
                          className="map-page-brog-lines__action-btn map-page-brog-lines__action-btn--danger"
                          onClick={() => void handleDeletePost(restaurant.id)}
                        >
                          삭제
                        </button>
                      </span>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : null}
      </section>
    </div>
    </div>
  )
}
