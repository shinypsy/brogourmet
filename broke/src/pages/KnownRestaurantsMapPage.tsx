import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { ACCESS_TOKEN_KEY, fetchMe, type User } from '../api/auth'
import {
  deleteKnownRestaurantPost,
  fetchKnownRestaurantPosts,
  type KnownRestaurantPost,
} from '../api/community'
import { KAKAO_MAP_APP_KEY, KAKAO_REST_API_KEY } from '../api/config'
import { BrogKakaoMap } from '../components/BrogKakaoMap'
import { BrogRankGridCarousel } from '../components/BrogRankGridCarousel'
import { MapPageBrogImageGridList } from '../components/MapPageBrogImageGridList'
import { useSeoulMapUserLocation } from '../hooks/useSeoulMapUserLocation'
import { haversineMeters } from '../lib/haversine'
import {
  clampStage1District,
  isStage1LimitedDistricts,
  mygDistrictOptionsForUi,
  STAGE1_DEFAULT_DISTRICT,
} from '../lib/deployStage1'
import { brogMygMapSectionHint } from '../lib/brogMygTwin'
import { fetchKakaoKeywordFirstPlace } from '../lib/kakaoKeywordSearch'
import { knownRestaurantPostMatchesMygMapSearch } from '../lib/mapBroSearch'
import { MAP_NEAR_RADIUS_M } from '../lib/mapConstants'
import { MYG_MAIN_MENU_PRICE_MAX_OPTIONS } from '../lib/mainMenuPriceMaxFilterOptions'
import { mygPostToRestaurantListItem } from '../lib/mygPostToRestaurantListItem'
import { canDeleteKnownRestaurantPost } from '../lib/roles'

const DEFAULT_DISTRICT = STAGE1_DEFAULT_DISTRICT

export function KnownRestaurantsMapPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const districtFromUrl = searchParams.get('district') ?? DEFAULT_DISTRICT

  const [district, setDistrictState] = useState(districtFromUrl)
  const [maxPrice, setMaxPrice] = useState(10000)
  const [posts, setPosts] = useState<KnownRestaurantPost[]>([])
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  /** BroG 지도와 동일: 좌표가 구와 어긋나면 반경 모드 */
  const [nearIgnoreDistrict, setNearIgnoreDistrict] = useState(false)
  const [mapMygSearchQuery, setMapMygSearchQuery] = useState('')
  const [mapPlaceQuery, setMapPlaceQuery] = useState('')
  const [placeSearchBusy, setPlaceSearchBusy] = useState(false)
  const [placeSearchHint, setPlaceSearchHint] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [carouselPage, setCarouselPage] = useState({ pageIndex: 0, pageCount: 1 })
  const onCarouselPagination = useCallback(
    (info: { pageIndex: number; pageCount: number }) => {
      setCarouselPage((prev) =>
        prev.pageIndex === info.pageIndex && prev.pageCount === info.pageCount ? prev : info,
      )
    },
    [],
  )

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
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    void reloadPosts()
  }, [reloadPosts])

  useEffect(() => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY)
    if (!token) return
    void fetchMe(token).then(setUser).catch(() => {})
  }, [])

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
    const { lat, lng } = mapUserCoords!
    const inRadius = withCoords.filter(
      (p) => haversineMeters(lat, lng, p.latitude!, p.longitude!) <= MAP_NEAR_RADIUS_M,
    )
    return [...inRadius].sort(
      (a, b) =>
        haversineMeters(lat, lng, a.latitude!, a.longitude!) -
        haversineMeters(lat, lng, b.latitude!, b.longitude!),
    )
  }, [postsMatchingPrice, mapUserCoords, useNearListMode])

  const visiblePosts = useMemo(
    () => sortedForList.filter((p) => knownRestaurantPostMatchesMygMapSearch(p, mapMygSearchQuery)),
    [sortedForList, mapMygSearchQuery],
  )

  const visibleListRows = useMemo(() => visiblePosts.map(mygPostToRestaurantListItem), [visiblePosts])

  const mygSearchTrimmed = mapMygSearchQuery.trim()

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
      setPlaceSearchHint(`「${p.placeName}」 근처로 맞췄습니다. 아래 목록이 반경 기준으로 다시 정렬됩니다.`)
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
        .map((p, idx) => ({
          id: p.id,
          title: p.restaurant_name || p.title,
          latitude: p.latitude as number,
          longitude: p.longitude as number,
          rank: idx + 1,
          markerKind: 'myg' as const,
        })),
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
        <p className="map-page-map-section__hint">{brogMygMapSectionHint(true)}</p>
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
            autoRefitWhenPinsChange={false}
            getDetailPath={(id) => `/known-restaurants/${id}`}
            mapAriaLabel="MyG 위치 지도"
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

      <section className="home-section map-page-brog-list-section" aria-label="MyG 목록">
        <h3 className="map-page-brog-list-section__title">목록 · 이미지</h3>
        <p className="helper map-page-brog-list-section__carousel-hint">
          BroG 리스트와 같이 <strong>8건씩</strong>입니다. <strong>« »</strong> 또는 그리드를{' '}
          <strong>좌우로 드래그</strong>(휴대폰은 밀기)해 넘길 수 있습니다.
        </p>
        {loadError ? <p className="error">{loadError}</p> : null}
        {loading ? <p className="helper map-page-brog-list-section__loading">불러오는 중…</p> : null}

        {!loading && visiblePosts.length > 0 && !loadError ? (
          <p className="brog-list-body__count" role="status">
            <strong>{visiblePosts.length}</strong>건 · {district} · 가격 {maxPrice.toLocaleString()}원 이하
            {carouselPage.pageCount > 1 ? (
              <>
                {' '}
                · 페이지 {carouselPage.pageIndex + 1} / {carouselPage.pageCount}
              </>
            ) : null}
          </p>
        ) : null}

        {!loading && sortedForList.length === 0 && !loadError ? (
          <p className="helper map-page-brog-list-section__empty">
            이 구에 표시할 글이 없습니다. 구·기준점(약 5km)·좌표를 조정해 보세요.
          </p>
        ) : !loading && sortedForList.length > 0 && visiblePosts.length === 0 && !loadError ? (
          <p className="helper map-page-brog-list-section__empty">
            MyG 글 검색어와 맞는 글이 없습니다. 검색어를 비우거나 장소 검색으로 기준을 바꿔 보세요.
          </p>
        ) : !loading && visibleListRows.length > 0 && !loadError ? (
          <BrogRankGridCarousel
            items={visibleListRows}
            resetKey={`${district}-${maxPrice}-${useNearListMode ? 'near' : 'gu'}-${mygSearchTrimmed}`}
            getItemKey={(r) => r.id}
            carouselStepAriaUnit="건"
            renderPage={(page, startRank) => (
              <MapPageBrogImageGridList
                items={page}
                getDetailHref={(r) => `/known-restaurants/${r.id}`}
                getRankDisplay={(_, i) => startRank + i}
                renderActions={(r) =>
                  user &&
                  r.submitted_by_user_id != null &&
                  canDeleteKnownRestaurantPost(user, r.submitted_by_user_id, r.district) ? (
                    <button
                      type="button"
                      className="map-page-brog-lines__action-btn map-page-brog-lines__action-btn--danger"
                      onClick={(e) => {
                        e.preventDefault()
                        void handleDeletePost(r.id)
                      }}
                    >
                      삭제
                    </button>
                  ) : null
                }
              />
            )}
            ariaLabel="MyG 이미지 목록, 8건씩"
            onPaginationInfo={onCarouselPagination}
          />
        ) : null}
      </section>
    </div>
  )
}
