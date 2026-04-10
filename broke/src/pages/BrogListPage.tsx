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
import { BrogRankCard } from '../components/BrogRankCard'
import { BrogRankGridCarousel } from '../components/BrogRankGridCarousel'
import {
  brogDistrictOptionsForUi,
  clampBrogDistrictForPhase1,
  isBrogPhase1Restricted,
} from '../lib/brogPhase1'
import {
  BROG_LIST_REFRESH_STATE_KEY,
  persistBrogListQuery,
} from '../lib/brogListNavigation'
import { BROG_MAIN_MENU_PRICE_MAX_OPTIONS } from '../lib/mainMenuPriceMaxFilterOptions'
import { assumeAdminUi, canManageBrogForDistrict, canSoftDeleteBrogListing } from '../lib/roles'

const DEFAULT_DISTRICT = '마포구'

export function BrogListPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const city = searchParams.get('city') ?? '서울특별시'
  const districtRaw = searchParams.get('district') ?? DEFAULT_DISTRICT
  const district = clampBrogDistrictForPhase1(districtRaw)

  useEffect(() => {
    if (!isBrogPhase1Restricted()) return
    const next = clampBrogDistrictForPhase1(districtRaw)
    if (next !== districtRaw) {
      setSearchParams({ city, district: next }, { replace: true })
    }
  }, [city, districtRaw, setSearchParams])

  const setDistrict = useCallback(
    (gu: string) => {
      const next = clampBrogDistrictForPhase1(gu)
      setSearchParams({ city, district: next }, { replace: true })
    },
    [city, setSearchParams],
  )

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
      void fetchRestaurants({ district, max_price: maxPrice })
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
  }, [district, maxPrice, listRefreshAt, listReloadTick])

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

  function renderRankCard(restaurant: RestaurantListItem, globalRank: number) {
    return (
      <BrogRankCard
        restaurant={restaurant}
        rank={globalRank}
        pinnedSlot={restaurant.bro_list_pin ?? null}
        footer={
          <>
            {canPinRow(restaurant) ? (
              <div className="brog-rank-card__pin-table" role="group" aria-label="목록 고정">
                <div className="brog-rank-card__pin-tr">
                  <div className="brog-rank-card__pin-td">
                    <button
                      type="button"
                      className="brog-rank-card__pin-btn"
                      disabled={pinBusyId === restaurant.id}
                      title="미고정: 구 내 빈 슬롯(1~4) 부여 · 고정됨: 다음 슬롯 순환"
                      onClick={() => void handleCycleListPin(restaurant.id)}
                    >
                      {pinBusyId === restaurant.id
                        ? '적용 중…'
                        : restaurant.bro_list_pin == null
                          ? '목록 고정'
                          : `고정 ${restaurant.bro_list_pin}위 (다음)`}
                    </button>
                  </div>
                  <div className="brog-rank-card__pin-td">
                    {restaurant.bro_list_pin != null ? (
                      <button
                        type="button"
                        className="brog-rank-card__pin-clear-btn"
                        disabled={pinBusyId === restaurant.id}
                        title="이 맛집만 고정 해제 (슬롯 비움)"
                        onClick={() => void handleClearListPin(restaurant.id)}
                      >
                        고정 해제
                      </button>
                    ) : (
                      <span className="brog-rank-card__pin-td-placeholder" aria-hidden />
                    )}
                  </div>
                </div>
              </div>
            ) : null}
            {canDeleteRow(restaurant) ? (
              <button
                type="button"
                className="brog-rank-card__delete-btn"
                onClick={() => void handleSoftDelete(restaurant)}
              >
                목록에서 숨기기
              </button>
            ) : null}
          </>
        }
      />
    )
  }

  const brogDistrictOptions = brogDistrictOptionsForUi()

  const emptyHint = isBrogPhase1Restricted()
    ? '이 구·가격 조건에 맞는 BroG가 없습니다. 다른 구를 고르거나 가격 상한을 조정해 보세요.'
    : '가격 상한을 조정하거나 지도에서 다른 구를 선택해 보세요.'

  return (
    <div className="brog-screen brog-screen--list">
      <header className="brog-screen__header">
        <div>
          <p className="eyebrow">BroG · 리스트</p>
          <h1 className="brog-screen__title">{pageTitle}</h1>
          <p className="brog-screen__meta">
            {city} · {district} · 대표 메뉴 {maxPrice.toLocaleString()}원 이하
          </p>
        </div>
        <div className="brog-screen__header-actions">
          <Link
            className="ghost-button"
            to={`/map?city=${encodeURIComponent(city)}&district=${encodeURIComponent(district)}`}
          >
            지도
          </Link>
          <Link className="brog-screen__cta" to="/restaurants/manage/new">
            BroG 등록
          </Link>
        </div>
      </header>

      <section className="brog-list-body" aria-label="BroG 목록">
        <div className="brog-screen__toolbar brog-screen__toolbar--list map-card">
          <label className="price-filter brog-list-toolbar__filter">
            <span className="brog-list-toolbar__label">가격 상한</span>
            <select value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))}>
              {BROG_MAIN_MENU_PRICE_MAX_OPTIONS.map((price) => (
                <option key={price} value={price}>
                  {price.toLocaleString()}원 이하
                </option>
              ))}
            </select>
          </label>
          <label className="price-filter brog-list-toolbar__filter">
            <span className="brog-list-toolbar__label">서울시</span>
            <select value={district} onChange={(e) => setDistrict(e.target.value)}>
              {brogDistrictOptions.map((gu) => (
                <option key={gu} value={gu}>
                  {gu}
                </option>
              ))}
            </select>
          </label>
          <div className="brog-list-toolbar__notes">
            <p className="helper brog-list-toolbar__note">
              카드를 누르면 상세로 이동합니다. 상세 「관리」에서 수정·목록 숨기기·(슈퍼) 영구 삭제를 할 수 있습니다.
            </p>
            <p className="helper brog-list-toolbar__note brog-list-toolbar__note--muted">
              목록은 <strong>8곳씩</strong>입니다. <strong>« »</strong> 또는 카드 영역을 <strong>좌우로 드래그</strong>
              (휴대폰은 밀기)해 넘길 수 있습니다.{' '}
              {isBrogPhase1Restricted()
                ? '1단계: 구 선택은 6개 구로 한정됩니다. 슈퍼·지역 담당 또는 본인이 등록한 BroG는 카드에서 바로 숨길 수 있습니다.'
                : '슈퍼·지역 담당 또는 본인이 등록한 BroG는 카드에서 목록·지도 숨김(소프트 삭제)을 할 수 있습니다.'}{' '}
              슈퍼·해당 구 지역 담당자: 「목록 고정」은 미고정 카드에{' '}
              <strong>이 구에서 비어 있는 1~4위</strong> 중 가장 앞 슬롯을 줍니다(1위가 있으면 새 카드는 2위부터).
              이미 고정된 카드에서는 1→2→3→4→해제 순환, 「고정 해제」는 이 카드만 즉시 비움.
            </p>
          </div>
        </div>

        {!isListLoading && !listError ? (
          <p className="brog-list-body__count" role="status">
            <strong>{restaurants.length}</strong>곳 · 가격 {maxPrice.toLocaleString()}원 이하
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
            <p className="brog-rank-section__sub brog-list-body__empty-hint">{emptyHint}</p>
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
            resetKey={`${district}-${maxPrice}`}
            getItemKey={(r) => r.id}
            renderItem={(restaurant, globalRank) => renderRankCard(restaurant, globalRank)}
            ariaLabel="BroG 카드 목록, 8곳씩"
            onPaginationInfo={onCarouselPagination}
          />
        ) : null}
      </section>
    </div>
  )
}
