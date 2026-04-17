import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { ACCESS_TOKEN_KEY, fetchMe, type User } from '../api/auth'
import { AUTH_CHANGE_EVENT } from '../authEvents'
import { deleteKnownRestaurantPost, fetchKnownRestaurantPosts, type KnownRestaurantPost } from '../api/community'
import { BrogRankGridCarousel } from '../components/BrogRankGridCarousel'
import { HomeStyleListToolbarGeo } from '../components/HomeStyleListSearchBlocks'
import { MapPageBrogImageGridList } from '../components/MapPageBrogImageGridList'
import { useSeoulMapUserLocation } from '../hooks/useSeoulMapUserLocation'
import { haversineMeters } from '../lib/haversine'
import { MAP_NEAR_RADIUS_M } from '../lib/mapConstants'
import {
  BROG_DISTRICT_ALL,
  clampStage1District,
  mygDistrictOptionsForUi,
  parseBrogDistrictUrlParam,
} from '../lib/deployStage1'
import { MYG_MAIN_MENU_PRICE_MAX_OPTIONS } from '../lib/mainMenuPriceMaxFilterOptions'
import {
  MYG_LIST_REFRESH_STATE_KEY,
  persistMygListQuery,
} from '../lib/mygListNavigation'
import { mygPostToRestaurantListItem } from '../lib/mygPostToRestaurantListItem'
import { canDeleteKnownRestaurantPost } from '../lib/roles'

/**
 * MyG 리스트 — BroG 리스트와 동일하게 이미지 그리드(2×4)·8건 캐러셀.
 * 데이터만 본인 KnownRestaurant + 구 필터.
 */
export function KnownRestaurantsBoardPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [posts, setPosts] = useState<KnownRestaurantPost[]>([])
  const [listError, setListError] = useState('')
  const [isListLoading, setIsListLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [maxPrice, setMaxPrice] = useState(10000)
  const [carouselPage, setCarouselPage] = useState({ pageIndex: 0, pageCount: 1 })
  const onCarouselPagination = useCallback(
    (info: { pageIndex: number; pageCount: number }) => {
      setCarouselPage((prev) =>
        prev.pageIndex === info.pageIndex && prev.pageCount === info.pageCount ? prev : info,
      )
    },
    [],
  )

  const listRefreshAt =
    typeof location.state === 'object' &&
    location.state !== null &&
    MYG_LIST_REFRESH_STATE_KEY in location.state
      ? Number((location.state as { mygListRefreshAt?: number }).mygListRefreshAt)
      : 0

  const districtRaw = searchParams.get('district')

  const districtFilter = useMemo(
    () => clampStage1District(parseBrogDistrictUrlParam(districtRaw)),
    [districtRaw],
  )

  useEffect(() => {
    const next = clampStage1District(parseBrogDistrictUrlParam(districtRaw))
    if ((districtRaw ?? '') !== next) {
      setSearchParams({ district: next }, { replace: true })
    }
  }, [districtRaw, setSearchParams])

  const setDistrictFilter = useCallback(
    (gu: string) => {
      if (gu === BROG_DISTRICT_ALL) {
        setSearchParams({ district: BROG_DISTRICT_ALL }, { replace: true })
        return
      }
      setSearchParams({ district: clampStage1District(gu) }, { replace: true })
    },
    [setSearchParams],
  )

  const setDistrictForGeo = useCallback(
    (gu: string) => {
      setDistrictFilter(clampStage1District(gu))
    },
    [setDistrictFilter],
  )

  const [nearIgnoreDistrict, setNearIgnoreDistrict] = useState(false)

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
  } = useSeoulMapUserLocation(setDistrictForGeo, {
    initialGeolocationSetsDistrict: false,
    enableInitialGeolocation: false,
    onApplyLatLngResolved: () => setNearIgnoreDistrict(true),
    onDeviceCoordsWithoutDistrictSync: () => setNearIgnoreDistrict(true),
  })

  const reload = useCallback(() => {
    setIsListLoading(true)
    setListError('')
    const t = localStorage.getItem(ACCESS_TOKEN_KEY)
    fetchKnownRestaurantPosts(t)
      .then(setPosts)
      .catch((loadError) => {
        setPosts([])
        setListError(loadError instanceof Error ? loadError.message : '목록을 불러오지 못했습니다.')
      })
      .finally(() => {
        setIsListLoading(false)
        const tok = localStorage.getItem(ACCESS_TOKEN_KEY)
        if (tok?.trim()) void fetchMe(tok).then(setUser).catch(() => setUser(null))
        else setUser(null)
      })
  }, [])

  useEffect(() => {
    void Promise.resolve().then(() => reload())
  }, [reload, listRefreshAt])

  useEffect(() => {
    try {
      persistMygListQuery(districtFilter)
    } catch {
      /* */
    }
  }, [districtFilter])

  /** 상세·수정에서 삭제 후 넘어온 state 제거(뒤로가기 시 이상한 재요청 방지) — BroG 리스트와 동일 */
  useEffect(() => {
    if (listRefreshAt <= 0) return
    navigate({ pathname: location.pathname, search: location.search }, { replace: true })
  }, [listRefreshAt, location.pathname, location.search, navigate])

  useEffect(() => {
    function onAuth() {
      void reload()
    }
    window.addEventListener(AUTH_CHANGE_EVENT, onAuth)
    return () => window.removeEventListener(AUTH_CHANGE_EVENT, onAuth)
  }, [reload])

  async function handleDelete(postId: number) {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY)
    if (!token) return
    if (!window.confirm('이 글을 삭제할까요?')) return
    try {
      await deleteKnownRestaurantPost(token, postId)
      reload()
    } catch (e) {
      setListError(e instanceof Error ? e.message : '삭제에 실패했습니다.')
    }
  }

  const postsMatchingDistrict = useMemo(() => {
    if (districtFilter === BROG_DISTRICT_ALL) return posts
    return posts.filter((p) => (p.district ?? '').trim() === districtFilter)
  }, [posts, districtFilter])

  const postsAfterDistrictOrNear = useMemo(() => {
    if (nearIgnoreDistrict && mapUserCoords) {
      const { lat, lng } = mapUserCoords
      return posts.filter(
        (p) =>
          typeof p.latitude === 'number' &&
          typeof p.longitude === 'number' &&
          haversineMeters(lat, lng, p.latitude, p.longitude) <= MAP_NEAR_RADIUS_M,
      )
    }
    return postsMatchingDistrict
  }, [posts, postsMatchingDistrict, nearIgnoreDistrict, mapUserCoords])

  /** BroG 지도·목록과 동일 UI — 대표 메뉴 가격으로 클라이언트 필터 */
  const filteredPosts = useMemo(
    () => postsAfterDistrictOrNear.filter((p) => Number(p.main_menu_price) <= maxPrice),
    [postsAfterDistrictOrNear, maxPrice],
  )

  const restaurants = useMemo(() => filteredPosts.map(mygPostToRestaurantListItem), [filteredPosts])

  const pageTitle =
    districtFilter === BROG_DISTRICT_ALL ? '전체 보기 · 내 글' : `${districtFilter} · 내 글`
  const mapDistrict = districtFilter

  const carouselResetKey = useMemo(
    () =>
      `${districtFilter}-${maxPrice}-${nearIgnoreDistrict}-${mapUserCoords?.lat ?? ''}-${mapUserCoords?.lng ?? ''}-${filteredPosts.map((p) => p.id).join('-')}`,
    [districtFilter, maxPrice, nearIgnoreDistrict, mapUserCoords, filteredPosts],
  )

  return (
    <div className="brog-screen brog-screen--list">
      <header className="brog-screen__header">
        <div>
          <p className="eyebrow">MyG · 리스트</p>
          <h1 className="brog-screen__title">{pageTitle}</h1>
        </div>
        <div className="brog-screen__header-actions">
          <Link
            className="ghost-button free-share-header-map-link"
            to={`/known-restaurants/map?district=${encodeURIComponent(mapDistrict)}`}
            aria-label="MyG 지도"
            title="MyG 지도"
          >
            <svg
              className="free-share-header-map-link__icon"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 21s-8-4.5-8-11a8 8 0 0 1 16 0c0 6.5-8 11-8 11z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
            <span className="visually-hidden">지도</span>
          </Link>
          <Link className="brog-screen__cta" to="/known-restaurants/write">
            작성
          </Link>
        </div>
      </header>

      <section className="brog-list-body" aria-label="MyG 목록">
        <div className="brog-list-body__map-stack map-layout map-layout--brog brog-screen--map">
          <div className="map-page-toolbar map-card">
            <div className="map-page-toolbar__filters-row">
              <label className="price-filter map-page-toolbar__filter">
                가격 상한
                <select value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))}>
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
                  value={districtFilter}
                  onChange={(e) => {
                    setNearIgnoreDistrict(false)
                    setDistrictFilter(clampStage1District(e.target.value))
                  }}
                >
                  {mygDistrictOptionsForUi().map((gu) => (
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
        </div>

        {!isListLoading && !listError ? (
          <p className="brog-list-body__count" role="status">
            <strong>{restaurants.length}</strong>곳 표시 · 가격 {maxPrice.toLocaleString()}원 이하
            {carouselPage.pageCount > 1 ? (
              <>
                {' '}
                · 페이지 {carouselPage.pageIndex + 1} / {carouselPage.pageCount}
              </>
            ) : null}
          </p>
        ) : null}

        {listError ? <p className="error brog-list-body__error">{listError}</p> : null}
        {isListLoading ? <p className="brog-rank-loading">목록을 불러오는 중…</p> : null}

        {!isListLoading && restaurants.length === 0 && !listError ? (
          <article className="brog-rank-card brog-rank-card--empty">
            <p className="brog-rank-card__name">표시할 내 글이 없습니다</p>
            <p className="helper" style={{ marginTop: 12 }}>
              <Link className="compact-link" to="/known-restaurants/write">
                MyG 작성하기
              </Link>
            </p>
          </article>
        ) : null}

        {!isListLoading && restaurants.length > 0 && !listError ? (
          <BrogRankGridCarousel
            items={restaurants}
            resetKey={carouselResetKey}
            getItemKey={(r) => r.id}
            renderPage={(page, startGlobalRankOneBased) => (
              <MapPageBrogImageGridList
                items={page}
                getDetailHref={(r) => `/known-restaurants/${r.id}`}
                getRankDisplay={(_r, i) => startGlobalRankOneBased + i}
                renderActions={(restaurant) =>
                  user &&
                  restaurant.submitted_by_user_id != null &&
                  canDeleteKnownRestaurantPost(user, restaurant.submitted_by_user_id, restaurant.district) ? (
                    <button
                      type="button"
                      className="map-page-brog-lines__action-btn map-page-brog-lines__action-btn--danger"
                      onClick={(e) => {
                        e.preventDefault()
                        void handleDelete(restaurant.id)
                      }}
                    >
                      삭제
                    </button>
                  ) : null
                }
              />
            )}
            ariaLabel="MyG 이미지 목록, 8곳씩"
            onPaginationInfo={onCarouselPagination}
          />
        ) : null}
      </section>
    </div>
  )
}
