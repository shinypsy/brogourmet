import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { ACCESS_TOKEN_KEY, fetchMe, type User } from '../api/auth'
import { deleteRestaurant, fetchRestaurants, type RestaurantListItem } from '../api/restaurants'
import { BrogRankCard } from '../components/BrogRankCard'
import { canManageBrogForDistrict, isSuperAdmin } from '../lib/roles'

const PRICE_FILTER_MAX_OPTIONS = [10000, 9000, 8000, 7000, 6000, 5000] as const
const DEFAULT_DISTRICT = '마포구'

export function BrogListPage() {
  const [searchParams] = useSearchParams()
  const city = searchParams.get('city') ?? '서울특별시'
  const district = searchParams.get('district') ?? DEFAULT_DISTRICT

  const [maxPrice, setMaxPrice] = useState(10000)
  const [restaurants, setRestaurants] = useState<RestaurantListItem[]>([])
  const [listError, setListError] = useState('')
  const [isListLoading, setIsListLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)

  const token = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null

  useEffect(() => {
    if (!token) {
      setUser(null)
      return
    }
    void fetchMe(token).then(setUser).catch(() => setUser(null))
  }, [token])

  const pageTitle = useMemo(() => `${district} BroG`, [district])

  useEffect(() => {
    let cancelled = false
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
    return () => {
      cancelled = true
    }
  }, [district, maxPrice])

  async function handleSoftDelete(restaurant: RestaurantListItem) {
    if (!token) {
      window.alert('로그인 후 삭제할 수 있습니다.')
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
    if (!user) return false
    if (isSuperAdmin(user.role)) return true
    return canManageBrogForDistrict(user.role, user.managed_district_id, r.district_id)
  }

  return (
    <div className="brog-screen brog-screen--list">
      <header className="brog-screen__header">
        <div>
          <p className="eyebrow">BroG · 리스트</p>
          <h1 className="brog-screen__title">{pageTitle}</h1>
          <p className="brog-screen__meta">
            {city} {district} · 대표 메뉴 {maxPrice.toLocaleString()}원 이하
          </p>
        </div>
        <div className="brog-screen__header-actions">
          <Link className="ghost-button" to="/">
            Home
          </Link>
          <Link className="ghost-button" to={`/map?city=${encodeURIComponent(city)}&district=${encodeURIComponent(district)}`}>
            지도
          </Link>
          <Link className="brog-screen__cta" to="/restaurants/manage/new">
            BroG 등록
          </Link>
        </div>
      </header>

      <div className="brog-screen__toolbar map-card">
        <label className="price-filter">
          가격 상한
          <select value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))}>
            {PRICE_FILTER_MAX_OPTIONS.map((price) => (
              <option key={price} value={price}>
                {price.toLocaleString()}원 이하
              </option>
            ))}
          </select>
        </label>
        <p className="helper" style={{ margin: 0 }}>
          테스트: 담당 권한이 있으면 카드에서 바로 숨김 삭제할 수 있습니다.
        </p>
      </div>

      <section className="brog-screen__body home-section brog-rank-section">
        {listError ? <p className="error">{listError}</p> : null}
        {isListLoading ? <p className="brog-rank-loading">맛집을 불러오는 중…</p> : null}

        {!isListLoading && restaurants.length === 0 && !listError ? (
          <article className="brog-rank-card brog-rank-card--empty">
            <p className="brog-rank-card__name brog-rank-card__name--primary">조건에 맞는 맛집이 없습니다</p>
            <p className="brog-rank-section__sub">가격 상한을 조정하거나 홈에서 다른 구를 선택해 보세요.</p>
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
