import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { ACCESS_TOKEN_KEY, fetchMe, type User } from '../api/auth'
import { deleteRestaurant, fetchRestaurants, type RestaurantListItem } from '../api/restaurants'
import { BrogRankCard } from '../components/BrogRankCard'
import {
  brogDistrictOptionsForUi,
  clampBrogDistrictForPhase1,
  isBrogPhase1Restricted,
} from '../lib/brogPhase1'
import { assumeAdminUi, canSoftDeleteBrogListing } from '../lib/roles'

const PRICE_FILTER_MAX_OPTIONS = [10000, 9000, 8000, 7000, 6000, 5000] as const
const DEFAULT_DISTRICT = '마포구'

export function BrogListPage() {
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
  const [user, setUser] = useState<User | null>(null)

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
  }, [district, maxPrice])

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
          <Link className="ghost-button" to="/">
            Home
          </Link>
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
              {PRICE_FILTER_MAX_OPTIONS.map((price) => (
                <option key={price} value={price}>
                  {price.toLocaleString()}원 이하
                </option>
              ))}
            </select>
          </label>
          <label className="price-filter brog-list-toolbar__filter">
            <span className="brog-list-toolbar__label">서울시 구</span>
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
              {isBrogPhase1Restricted()
                ? '1단계: 구 선택은 6개 구로 한정됩니다. 슈퍼·지역 담당 또는 본인이 등록한 BroG는 카드에서 바로 숨길 수 있습니다.'
                : '슈퍼·지역 담당 또는 본인이 등록한 BroG는 카드에서 목록·지도 숨김(소프트 삭제)을 할 수 있습니다.'}
            </p>
          </div>
        </div>

        {!isListLoading && !listError ? (
          <p className="brog-list-body__count" role="status">
            <strong>{restaurants.length}</strong>곳 · 가격 {maxPrice.toLocaleString()}원 이하
          </p>
        ) : null}

        {listError ? <p className="error brog-list-body__error">{listError}</p> : null}
        {isListLoading ? <p className="brog-rank-loading">맛집을 불러오는 중…</p> : null}

        {!isListLoading && restaurants.length === 0 && !listError ? (
          <article className="brog-rank-card brog-rank-card--empty">
            <p className="brog-rank-card__name brog-rank-card__name--primary">조건에 맞는 맛집이 없습니다</p>
            <p className="brog-rank-section__sub brog-list-body__empty-hint">{emptyHint}</p>
            <p className="helper" style={{ marginTop: 12 }}>
              <Link className="compact-link" to="/restaurants/manage/new">
                BroG 등록하기
              </Link>
            </p>
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
    </div>
  )
}
