import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { fetchRestaurants, type RestaurantListItem } from '../api/restaurants'
import { FoodPhotoWithMenuOverlay } from '../components/FoodPhotoWithMenuOverlay'
import { SaloonWelcome } from '../components/SaloonWelcome'
import { resolveMediaUrl } from '../lib/mediaUrl'
import {
  DEFAULT_HOME_DISTRICT,
  resolveSeoulDistrictFromCoords,
  type ResolveDistrictReason,
} from '../lib/resolveSeoulDistrictFromCoords'
import { seoulDistricts } from '../data/regions'

/** 홈 상단 공지 — 문구만 바꿔 운영 안내에 활용 */
const HOME_NOTICE_TITLE = '공지사항'
const HOME_NOTICE_BODY =
  'Broke Gourmet(고단한 미식가)는 서울 기준 대표 주 메뉴 1만 원 이하 맛집을 소개합니다. 위치 권한을 허용하면 현재 구가 자동으로 선택되며, 언제든지 아래 메뉴에서 구를 바꿀 수 있습니다.'

function geoHintMessage(reason: ResolveDistrictReason, district: string): string {
  switch (reason) {
    case 'ok':
      return `위치를 기준으로 ${district}를 선택했습니다.`
    case 'outside_seoul':
      return `서울 외 지역이 감지되어 기본 구(${DEFAULT_HOME_DISTRICT})를 사용합니다.`
    case 'no_key':
      return `현재 위치로 구를 자동 설정할 수 없어 기본 구(${district})를 사용합니다. 아래에서 구를 바꿀 수 있습니다.`
    case 'denied':
      return '위치 권한이 없어 기본 구를 사용합니다. 구는 아래에서 바꿀 수 있습니다.'
    case 'position_error':
      return '위치를 가져오지 못해 기본 구를 사용합니다.'
    case 'network':
    case 'unknown_address':
      return '주소를 확인하지 못해 기본 구를 사용합니다.'
    default:
      return '기본 구를 사용합니다.'
  }
}

export function HomePage() {
  const [district, setDistrict] = useState(DEFAULT_HOME_DISTRICT)
  const [geoHint, setGeoHint] = useState('위치 확인 중…')
  const [recommendedRestaurants, setRecommendedRestaurants] = useState<RestaurantListItem[]>([])
  const [listError, setListError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function locate() {
      if (!navigator.geolocation) {
        if (!cancelled) {
          setGeoHint(geoHintMessage('position_error', DEFAULT_HOME_DISTRICT))
        }
        return
      }

      await new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            if (cancelled) {
              resolve()
              return
            }
            const { district: gu, reason } = await resolveSeoulDistrictFromCoords(
              pos.coords.latitude,
              pos.coords.longitude,
            )
            if (cancelled) {
              resolve()
              return
            }
            setDistrict(gu)
            setGeoHint(geoHintMessage(reason, gu))
            resolve()
          },
          (err: GeolocationPositionError) => {
            if (!cancelled) {
              if (err.code === err.PERMISSION_DENIED) {
                setGeoHint(geoHintMessage('denied', DEFAULT_HOME_DISTRICT))
              } else {
                setGeoHint(geoHintMessage('position_error', DEFAULT_HOME_DISTRICT))
              }
            }
            resolve()
          },
          { enableHighAccuracy: false, timeout: 14_000, maximumAge: 120_000 },
        )
      })
    }

    void locate()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchRestaurants({ district, max_price: 10000, limit: 4 })
      .then((rows) => {
        if (!cancelled) {
          setRecommendedRestaurants(rows)
          setListError('')
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setRecommendedRestaurants([])
          setListError(error instanceof Error ? error.message : '맛집을 불러오지 못했습니다.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [district])

  const slots = Array.from({ length: 4 }, (_, i) => recommendedRestaurants[i] ?? null)

  return (
    <>
      <SaloonWelcome />
      <div className="home-layout home-layout--hub">
        <h1 className="visually-hidden">Broke Gourmet 홈</h1>

        <section className="service-overview home-notice" aria-labelledby="home-notice-heading">
          <p className="eyebrow">Stack</p>
          <h2 id="home-notice-heading">{HOME_NOTICE_TITLE}</h2>
          <p className="description">{HOME_NOTICE_BODY}</p>
        </section>

        <section className="home-hub" aria-labelledby="home-hub-region-label">
          <span id="home-hub-region-label" className="visually-hidden">
            지역 선택 및 추천 맛집 사진
          </span>

          <div className="home-hub__district">
            <label>
              서울시 구
              <select value={district} onChange={(e) => setDistrict(e.target.value)}>
                {seoulDistricts.map((gu) => (
                  <option key={gu} value={gu}>
                    {gu}
                  </option>
                ))}
              </select>
            </label>
            <p className="home-hub__geo-hint">{geoHint}</p>
          </div>

          {listError ? <p className="error home-hub__error">{listError}</p> : null}

          <div className="home-hub__photo-grid">
            {slots.map((restaurant, index) =>
              restaurant ? (
                <Link
                  key={restaurant.id}
                  to={`/restaurants/${restaurant.id}`}
                  className="home-hub__photo-card"
                  aria-label={`${restaurant.name} 상세 보기`}
                >
                  <HomePhotoSlot restaurant={restaurant} />
                </Link>
              ) : (
                <div
                  key={`empty-${index}`}
                  className="home-hub__photo-card home-hub__photo-card--empty"
                  aria-hidden
                />
              ),
            )}
          </div>
        </section>
      </div>
    </>
  )
}

function HomePhotoSlot({ restaurant }: { restaurant: RestaurantListItem }) {
  const [failed, setFailed] = useState(false)
  const first =
    restaurant.image_urls && restaurant.image_urls.length > 0
      ? restaurant.image_urls[0]
      : restaurant.image_url
  const src = resolveMediaUrl(first)
  const showImg = Boolean(src) && !failed

  return (
    <FoodPhotoWithMenuOverlay
      menuName={restaurant.main_menu_name}
      priceKrw={restaurant.main_menu_price}
    >
      {showImg ? (
        <img src={src!} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      ) : (
        <span className="food-photo-overlay-wrap__filler home-hub__photo-placeholder" aria-hidden />
      )}
    </FoodPhotoWithMenuOverlay>
  )
}
