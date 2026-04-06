import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ACCESS_TOKEN_KEY, fetchMe, type User } from '../api/auth'
import { deleteRestaurant, fetchRestaurant, type RestaurantDetail } from '../api/restaurants'

export function RestaurantDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [restaurant, setRestaurant] = useState<RestaurantDetail | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY)
    if (!token) return
    void fetchMe(token).then(setUser).catch(() => {})
  }, [])

  useEffect(() => {
    const numericId = Number(id)
    if (!Number.isFinite(numericId)) {
      setError('잘못된 맛집 ID입니다.')
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError('')

    fetchRestaurant(numericId)
      .then((data) => {
        if (!cancelled) {
          setRestaurant(data)
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setRestaurant(null)
          setError(loadError instanceof Error ? loadError.message : '맛집 정보를 불러오지 못했습니다.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [id])

  if (isLoading) {
    return (
      <section className="card">
        <p>불러오는 중...</p>
      </section>
    )
  }

  if (error || !restaurant) {
    return (
      <section className="card">
        <h1>맛집을 찾을 수 없습니다</h1>
        <p className="description">{error || '목록에서 다시 선택해 주세요.'}</p>
        <Link className="compact-link" to="/map">
          맛집 지도로
        </Link>
      </section>
    )
  }

  const mainItem = restaurant.menu_items.find((item) => item.is_main_menu)

  async function handleDelete() {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY)
    if (!token || !restaurant) return
    if (!window.confirm('이 BroG를 삭제할까요?')) return
    try {
      await deleteRestaurant(token, restaurant.id)
      navigate('/map')
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제에 실패했습니다.')
    }
  }

  return (
    <div className="detail-layout">
      <section className="card">
        <p className="eyebrow">Restaurant</p>
        <h1>{restaurant.name}</h1>
        <p className="description">
          {restaurant.district} · {restaurant.category}
          {mainItem
            ? ` · 대표 주 메뉴 ${mainItem.price_krw.toLocaleString()}원 이하 등재 기준 충족`
            : null}
        </p>

        {restaurant.image_url ? (
          <div className="restaurant-hero-image">
            <img src={restaurant.image_url} alt={`${restaurant.name} 사진`} />
          </div>
        ) : (
          <div className="photo-placeholder" aria-hidden="true">
            사진 영역
            <span className="photo-placeholder-note">이미지 URL이 등록되면 여기에 표시됩니다.</span>
          </div>
        )}

        <h2 style={{ marginTop: 24, marginBottom: 8 }}>메뉴 · 가격</h2>
        <table className="menu-table">
          <thead>
            <tr>
              <th>구분</th>
              <th>메뉴명</th>
              <th>가격</th>
            </tr>
          </thead>
          <tbody>
            {restaurant.menu_items.map((item) => (
              <tr key={item.id}>
                <td>{item.is_main_menu ? '대표' : '부메뉴'}</td>
                <td>{item.name}</td>
                <td>{item.price_krw.toLocaleString()}원</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="helper compact-helper">
          부메뉴는 10,000원을 넘어도 등록 가능합니다. 가격표는 추후 관리자·점주 수정 API와 연동합니다.
        </p>

        <div className="compact-links" style={{ marginTop: 20 }}>
          <Link className="compact-link" to="/map">
            지도로
          </Link>
          {user?.role === 'admin' ? (
            <>
              <Link className="compact-link" to={`/restaurants/manage/${restaurant.id}`}>
                수정
              </Link>
              <button type="button" className="compact-link" onClick={handleDelete}>
                삭제
              </button>
            </>
          ) : null}
          <Link className="compact-link" to="/payment">
            결제·프리미엄 안내
          </Link>
        </div>
      </section>
    </div>
  )
}
