import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { ACCESS_TOKEN_KEY, fetchMe, type User } from '../api/auth'
import {
  clearBroListPin,
  cycleBroListPin,
  deleteRestaurant,
  fetchRestaurants,
  type RestaurantListItem,
} from '../api/restaurants'
import { BrogRankGridCarousel } from '../components/BrogRankGridCarousel'
import { HomeStyleListToolbarGeo } from '../components/HomeStyleListSearchBlocks'
import { MapPageBrogImageGridList } from '../components/MapPageBrogImageGridList'
import { useSeoulMapUserLocation } from '../hooks/useSeoulMapUserLocation'
import { MAP_NEAR_RADIUS_M } from '../lib/mapConstants'
import {
  BROG_DISTRICT_ALL,
  brogDistrictOptionsForUi,
  clampBrogDistrictForPhase1,
  parseBrogDistrictUrlParam,
} from '../lib/brogPhase1'
import {
  BROG_LIST_REFRESH_STATE_KEY,
  persistBrogListQuery,
} from '../lib/brogListNavigation'
import { BROG_MAIN_MENU_PRICE_MAX_OPTIONS } from '../lib/mainMenuPriceMaxFilterOptions'
import { assumeAdminUi, canManageBrogForDistrict, canSoftDeleteBrogListing } from '../lib/roles'

export function BrogListPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const city = searchParams.get('city') ?? '서울특별시'
  const districtUrlRaw = searchParams.get('district')
  const district = clampBrogDistrictForPhase1(parseBrogDistrictUrlParam(districtUrlRaw))

  useEffect(() => {
    if ((districtUrlRaw ?? '') !== district) {
      setSearchParams({ city, district }, { replace: true })
    }
  }, [city, districtUrlRaw, district, setSearchParams])

  const setDistrict = useCallback(
    (gu: string) => {
      const next = clampBrogDistrictForPhase1(gu)
      setSearchParams({ city, district: next }, { replace: true })
    },
    [city, setSearchParams],
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
  } = useSeoulMapUserLocation(setDistrict, {
    initialGeolocationSetsDistrict: false,
    enableInitialGeolocation: false,
    onApplyLatLngResolved: () => setNearIgnoreDistrict(true),
    onDeviceCoordsWithoutDistrictSync: () => setNearIgnoreDistrict(true),
  })

  const nearLat = mapUserCoords?.lat ?? null
  const nearLng = mapUserCoords?.lng ?? null

  const [maxPrice, setMaxPrice] = useState(10000)
  const [restaurants, setRestaurants] = useState<RestaurantListItem[]>([])
  const [listError, setListError] = useState('')
  const [isListLoading, setIsListLoading] = useState(true)
  const listRefreshAt =
    typeof location.state === 'object' &&
    location.state !== null &&
    BROG_LIST_REFRESH_STATE_KEY in location.state
      ? Number((location.state as { brogListRefreshAt?: number }).brogListRefreshAt)
      : 0

  const [user, setUser] = useState<User | null>(null)
  const [listReloadTick, setListReloadTick] = useState(0)
  const [pinBusyId, setPinBusyId] = useState<number | null>(null)

  const [carouselPage, setCarouselPage] = useState({ pageIndex: 0, pageCount: 1 })
  const onCarouselPagination = useCallback(
    (info: { pageIndex: number; pageCount: number }) => {
      setCarouselPage((prev) =>
        prev.pageIndex === info.pageIndex && prev.pageCount === info.pageCount ? prev : info,
      )
    },
    [],
  )

  const token = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null

  useEffect(() => {
    let cancelled = false
    void Promise.resolve().then(() => {
      if (cancelled) return
      if (!token) {
        setUser(null)
        return
      }
      void fetchMe(token).then(setUser).catch(() => setUser(null))
    })
    return () => {
      cancelled = true
    }
  }, [token])

  const pageTitle = useMemo(() => `${district} BroG`, [district])

  useEffect(() => {
    try {
      persistBrogListQuery(city, district)
    } catch {
      /* */
    }
  }, [city, district])

  useEffect(() => {
    let cancelled = false
    void Promise.resolve().then(() => {
      if (cancelled) return
      setIsListLoading(true)
      setListError('')
      const base = {
        ...(district !== BROG_DISTRICT_ALL ? { district } : {}),
        max_price: maxPrice,
      } as const
      const useNearForListApi = nearIgnoreDistrict && nearLat != null && nearLng != null
      const params = useNearForListApi
        ? {
            ...base,
            near_lat: nearLat,
            near_lng: nearLng,
            radius_m: MAP_NEAR_RADIUS_M,
            near_ignore_district: true as const,
          }
        : base
      void fetchRestaurants(params)
        .then((data) => {
          if (!cancelled) setRestaurants(data)
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
    })
    return () => {
      cancelled = true
    }
  }, [district, maxPrice, nearLat, nearLng, nearIgnoreDistrict, listRefreshAt, listReloadTick])

  /** 상세·관리에서 삭제 후 넘어온 state 제거(뒤로가기 시 이상한 재요청 방지) */
  useEffect(() => {
    if (listRefreshAt <= 0) return
    navigate({ pathname: location.pathname, search: location.search }, { replace: true })
  }, [listRefreshAt, location.pathname, location.search, navigate])

  async function handleSoftDelete(restaurant: RestaurantListItem) {
    if (!token) {
      window.alert(
        assumeAdminUi() ? '테스트 UI: 숨김은 로그인 후 API 호출이 필요합니다.' : '로그인 후 삭제할 수 있습니다.',
      )
      return
    }
    if (
      !window.confirm(
        `「${restaurant.name}」을(를) 지도·목록에서 숨길까요? (소프트 삭제)`,
      )
    ) {
      return
    }
    try {
      await deleteRestaurant(token, restaurant.id)
      setRestaurants((prev) => prev.filter((r) => r.id !== restaurant.id))
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '삭제에 실패했습니다.')
    }
  }

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

  const brogDistrictOptions = brogDistrictOptionsForUi()

  return (
    <div className="brog-screen brog-screen--list">
      <header className="brog-screen__header brog-screen__header--title-inline">
        <div>
          <p className="eyebrow">BroG · 리스트</p>
          <div className="brog-screen__title-row">
            <h1 className="brog-screen__title">{pageTitle}</h1>
            <div className="brog-screen__header-actions">
              <Link
                className="ghost-button free-share-header-map-link"
                to={`/map?city=${encodeURIComponent(city)}&district=${encodeURIComponent(district)}`}
                aria-label="BroG 지도"
                title="BroG 지도"
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
              <Link
                className="ghost-button free-share-header-map-link"
                to="/restaurants/manage/new"
                aria-label="BroG 등록"
                title="BroG 등록"
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
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                  <line x1="12" y1="9" x2="12" y2="15" />
                  <line x1="9" y1="12" x2="15" y2="12" />
                </svg>
                <span className="visually-hidden">BroG 등록</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <section className="brog-list-body" aria-label="BroG 목록">
        <div className="brog-list-body__map-stack map-layout map-layout--brog brog-screen--map">
          {/* 홈 MapPageBody와 동일: `map-page-toolbar map-card`만 — 가격·구·좌표 한 카드·가로 배치(PC) */}
          <div className="map-page-toolbar map-card">
            <div className="map-page-toolbar__filters-row">
              <label className="price-filter map-page-toolbar__filter">
                가격 상한
                <select value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))}>
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
        {isListLoading ? <p className="brog-rank-loading">맛집을 불러오는 중…</p> : null}

        {!isListLoading && restaurants.length === 0 && !listError ? (
          <article className="brog-rank-card brog-rank-card--empty">
            <p className="brog-rank-card__name">조건에 맞는 맛집이 없습니다</p>
            <p className="helper" style={{ marginTop: 12 }}>
              <Link className="compact-link" to="/restaurants/manage/new">
                BroG 등록하기
              </Link>
            </p>
          </article>
        ) : null}

        {!isListLoading && restaurants.length > 0 && !listError ? (
          <BrogRankGridCarousel
            items={restaurants}
            resetKey={`${district}-${maxPrice}-${nearIgnoreDistrict}-${nearLat ?? ''}-${nearLng ?? ''}`}
            getItemKey={(r) => r.id}
            renderPage={(page, startGlobalRankOneBased) => (
              <MapPageBrogImageGridList
                items={page}
                getDetailHref={(r) => `/restaurants/${r.id}`}
                getRankDisplay={(r, i) => {
                  const pin = r.bro_list_pin
                  const seq = startGlobalRankOneBased + i
                  return pin != null && pin >= 1 && pin <= 4 ? pin : seq
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
            )}
            ariaLabel="BroG 이미지 목록, 8곳씩"
            onPaginationInfo={onCarouselPagination}
          />
        ) : null}
      </section>
    </div>
  )
}
