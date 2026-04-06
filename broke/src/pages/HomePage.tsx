import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { fetchRestaurants, type RestaurantListItem } from '../api/restaurants'
import { seoulDistricts } from '../data/regions'

const DEFAULT_DISTRICT = '마포구'
const FIXED_LOCATION_TEXT = '현재 위치는 마포구로 고정되어 있습니다.'

export function HomePage() {
  const navigate = useNavigate()
  const [districtInput, setDistrictInput] = useState<string>(DEFAULT_DISTRICT)
  const [autoDistrict] = useState<string>(DEFAULT_DISTRICT)
  const [locationText] = useState(FIXED_LOCATION_TEXT)
  const [recommendedRestaurants, setRecommendedRestaurants] = useState<RestaurantListItem[]>([])
  const [detailSampleId, setDetailSampleId] = useState<number | null>(null)
  const [listError, setListError] = useState('')

  const selectedMessage = useMemo(
    () => `서울특별시 ${districtInput} 기준 1만원 이하 대표 메뉴 맛집을 볼 수 있습니다.`,
    [districtInput],
  )

  useEffect(() => {
    let cancelled = false
    fetchRestaurants({ district: DEFAULT_DISTRICT, max_price: 10000, limit: 4 })
      .then((rows) => {
        if (!cancelled) {
          setRecommendedRestaurants(rows)
          setDetailSampleId(rows[0]?.id ?? null)
          setListError('')
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setRecommendedRestaurants([])
          setDetailSampleId(null)
          setListError(error instanceof Error ? error.message : '추천 맛집을 불러오지 못했습니다.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  function moveToMap() {
    const gu = districtInput.trim() || DEFAULT_DISTRICT
    navigate(`/map?city=서울특별시&district=${encodeURIComponent(gu)}`)
  }

  return (
    <div className="home-layout">
      <section className="service-overview" aria-labelledby="service-overview-title">
        <p className="eyebrow">Stack</p>
        <h3 id="service-overview-title">Python · React · JWT 기반 서비스 구성</h3>
        <p className="description">
          백엔드는 FastAPI, 프론트는 React이며 회원은 JWT로 인증합니다. 맛집 목록·상세는{' '}
          <code>/restaurants</code>, 무료나눔·내가 아는 맛집·결제 의도는 각 API와 연동되어 있습니다.
        </p>
        <div className="service-link-grid">
          <Link to={`/map?city=서울특별시&district=${encodeURIComponent(DEFAULT_DISTRICT)}`}>마포구 BroG</Link>
          <Link to="/map?mode=current">고정 위치 BroG</Link>
          <Link to={detailSampleId != null ? `/restaurants/${detailSampleId}` : '/map'}>
            맛집 상세 (사진·메뉴·가격)
          </Link>
          <Link to="/free-share">무료나눔 게시판</Link>
          <Link to="/known-restaurants">내가 아는 맛집 게시판</Link>
          <Link to="/me">회원 정보</Link>
          <Link to="/payment">결제</Link>
        </div>
      </section>

      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Broke Gourmet</p>
          <h2>마포구 기준 추천 맛집</h2>
          <p className="description">
            기본 구는 마포구이며 대표 주 메뉴가 10,000원 이하인 식당만 고단한 미식가에 등재됩니다.
          </p>
          <p className="helper compact-helper">
            {locationText}
          </p>

          <div className="hero-actions">
            <Link
              className="primary-link"
              to={`/map?city=서울특별시&district=${encodeURIComponent(DEFAULT_DISTRICT)}`}
            >
              마포구 BroG 보기
            </Link>
            <Link className="ghost-button" to="/signup">
              회원가입
            </Link>
            <Link className="ghost-button" to="/login">
              로그인
            </Link>
          </div>
        </div>

        <aside className="filter-card">
          <h3>지역 선택</h3>
          <p className="description">
            기본값은 마포구입니다. 다른 구를 보고 싶다면 아래 입력값만 직접 바꾸면 됩니다.
          </p>

          <div className="filter-grid">
            <label>
              시/도
              <select value="서울특별시" disabled>
                <option>서울특별시</option>
              </select>
            </label>

            <div className="district-row">
              <label>
                고정 위치 구
                <input
                  readOnly
                  value={autoDistrict}
                />
              </label>
              <label>
                구 (입력·수정)
                <input
                  value={districtInput}
                  onChange={(event) => setDistrictInput(event.target.value)}
                  list="seoul-district-suggestions"
                  placeholder="예: 마포구"
                  maxLength={20}
                />
                <datalist id="seoul-district-suggestions">
                  {seoulDistricts.map((district) => (
                    <option key={district} value={district} />
                  ))}
                </datalist>
              </label>
            </div>
          </div>

          <p className="helper compact-helper">{selectedMessage}</p>
          <button type="button" onClick={moveToMap}>
            선택한 지역 맛집 보기
          </button>
        </aside>
      </section>

      <section className="home-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Near Me</p>
            <h3>마포구 추천 맛집 4곳</h3>
          </div>
        </div>

        {listError ? <p className="error">{listError}</p> : null}

        <div className="home-recommend-grid">
          {recommendedRestaurants.map((restaurant) => (
            <article className="recommend-card" key={restaurant.id}>
              <div className="restaurant-card-header">
                <span className="badge">{restaurant.district}</span>
                <span className="restaurant-category">{restaurant.category}</span>
              </div>
              <h4>
                <Link to={`/restaurants/${restaurant.id}`}>{restaurant.name}</Link>
              </h4>
              <p>{restaurant.summary}</p>
              <div className="recommend-meta">
                <span>{restaurant.main_menu_name}</span>
                <strong>{restaurant.main_menu_price.toLocaleString()}원 이하</strong>
              </div>
            </article>
          ))}
        </div>
        <div className="compact-links">
          <Link className="compact-link" to={`/map?city=서울특별시&district=${encodeURIComponent(DEFAULT_DISTRICT)}`}>
            마포구 BroG
          </Link>
          <Link className="compact-link" to="/login">
            로그인
          </Link>
          <Link className="compact-link" to="/map?mode=current">
            지도 보기
          </Link>
          <Link className="compact-link" to="/free-share">
            무료나눔
          </Link>
          <Link className="compact-link" to="/known-restaurants">
            내가 아는 맛집
          </Link>
          <Link className="compact-link" to="/payment">
            결제
          </Link>
        </div>
      </section>
    </div>
  )
}
