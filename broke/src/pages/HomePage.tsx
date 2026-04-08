import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { fetchRestaurants, type RestaurantListItem } from '../api/restaurants'
import { FoodPhotoWithMenuOverlay } from '../components/FoodPhotoWithMenuOverlay'
import { HomeAccountDock } from '../components/HomeAccountDock'
import { HomeKakaoMap } from '../components/HomeKakaoMap'
import { SaloonWelcome } from '../components/SaloonWelcome'
import { useSeoulMapUserLocation } from '../hooks/useSeoulMapUserLocation'
import {
  brogDistrictOptionsForUi,
  clampBrogDistrictForPhase1,
  isBrogPhase1Restricted,
} from '../lib/brogPhase1'
import { imgReferrerPolicyForResolvedSrc, resolveMediaUrl } from '../lib/mediaUrl'
import { MAP_NEAR_RADIUS_M } from '../lib/mapConstants'
import { DEFAULT_HOME_DISTRICT } from '../lib/resolveSeoulDistrictFromCoords'

/** 홈 상단 공지 — 문구만 바꿔 운영 안내에 활용 */
const HOME_NOTICE_TITLE = '공지사항'
const HOME_NOTICE_BODY_FULL =
  'Broke Gourmet(고단한 미식가)는 서울 기준 대표 주 메뉴 1만 원 이하 맛집을 소개합니다. GPS로 위치를 받거나, 지도를 길게 누르거나 우클릭해 그 지점을 내 위치로 잡을 수 있으며, 아래에서 위도·경도를 직접 넣어 「좌표 적용」할 수도 있습니다. 지도 「내 위치」 버튼은 GPS 기준이며, 구는 드롭다운에서도 바꿀 수 있습니다.'
const HOME_NOTICE_BODY_PHASE1 =
  '현재 빌드는 1단계 테스트 버전입니다. 지역 선택은 마포·용산·서대문·영등포·종로·중구 6개 구로 한정됩니다. 각 구 안 BroG는 가격 조건에 맞게 노출됩니다. 정식 오픈·서울 전 구 확장 시 빌드 옵션(VITE_BROG_FULL_MAP)과 공지로 안내합니다.'

export function HomePage() {
  const [district, setDistrictState] = useState(DEFAULT_HOME_DISTRICT)
  const setDistrict = useCallback((gu: string) => {
    setDistrictState(clampBrogDistrictForPhase1(gu))
  }, [])
  const [recommendedRestaurants, setRecommendedRestaurants] = useState<RestaurantListItem[]>([])
  const [listError, setListError] = useState('')

  const {
    geoHint,
    geoBusy,
    setGeoRetryToken,
    mapUserCoords,
    latInput,
    setLatInput,
    lngInput,
    setLngInput,
    coordApplyError,
    handleApplyManualCoords,
    myLocationFromDevice,
    applyLatLng,
  } = useSeoulMapUserLocation(setDistrict)

  useEffect(() => {
    let cancelled = false
    const base = { district, max_price: 10000, limit: 4 } as const
    const params =
      mapUserCoords != null
        ? {
            ...base,
            near_lat: mapUserCoords.lat,
            near_lng: mapUserCoords.lng,
            radius_m: MAP_NEAR_RADIUS_M,
          }
        : base

    fetchRestaurants(params)
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
  }, [district, mapUserCoords])

  const slots = Array.from({ length: 4 }, (_, i) => recommendedRestaurants[i] ?? null)

  const onMapLocate = useCallback(() => {
    void myLocationFromDevice()
  }, [myLocationFromDevice])

  const onPickUserLocationOnMap = useCallback(
    (lat: number, lng: number) => {
      void applyLatLng(lat, lng)
    },
    [applyLatLng],
  )

  const homeNoticeBody = isBrogPhase1Restricted() ? HOME_NOTICE_BODY_PHASE1 : HOME_NOTICE_BODY_FULL
  const homeNoticeTitle = isBrogPhase1Restricted() ? '공지 · 1단계 테스트 버전' : HOME_NOTICE_TITLE
  const brogDistrictOptions = brogDistrictOptionsForUi()

  return (
    <>
      <SaloonWelcome />
      <div className="home-layout home-layout--hub">
        <h1 className="visually-hidden">Broke Gourmet 홈</h1>

        <section className="service-overview home-notice" aria-labelledby="home-notice-heading">
          <p className="eyebrow">Stack</p>
          <h2 id="home-notice-heading">{homeNoticeTitle}</h2>
          <p className="description">{homeNoticeBody}</p>
        </section>

        <HomeKakaoMap
          userCoords={mapUserCoords}
          restaurants={recommendedRestaurants}
          locating={geoBusy}
          onMyLocationClick={onMapLocate}
          onPickUserLocationOnMap={onPickUserLocationOnMap}
        />

        <section className="home-hub" aria-labelledby="home-hub-region-label">
          <span id="home-hub-region-label" className="visually-hidden">
            지역 선택 및 추천 맛집 사진
          </span>

          <div className="home-hub__district">
            <label>
              서울시 구
              <select value={district} onChange={(e) => setDistrict(e.target.value)}>
                {brogDistrictOptions.map((gu) => (
                  <option key={gu} value={gu}>
                    {gu}
                  </option>
                ))}
              </select>
            </label>
            <p className="home-hub__geo-hint">
              {geoBusy ? `${geoHint} (최대 약 1분까지 시도 중…)` : geoHint}
              {navigator.geolocation ? (
                <>
                  {' '}
                  <button
                    type="button"
                    className="home-hub__geo-retry"
                    disabled={geoBusy}
                    onClick={() => setGeoRetryToken((t) => t + 1)}
                  >
                    {geoBusy ? '위치 받는 중…' : '위치 다시 받기'}
                  </button>
                </>
              ) : null}
            </p>
            <div
              className="home-hub__coord-edit"
              aria-label="위도 경도 직접 입력"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void handleApplyManualCoords()
                }
              }}
            >
              <div className="home-hub__coord-row">
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
                <button
                  type="button"
                  className="home-hub__coord-apply"
                  onClick={() => void handleApplyManualCoords()}
                >
                  좌표 적용
                </button>
              </div>
              {coordApplyError ? <p className="error home-hub__coord-error">{coordApplyError}</p> : null}
              <p className="helper home-hub__coord-hint">
                적용 시 지도 중심·내 위치 마커·선택 구·추천 4곳이 이 좌표 기준으로 갱신됩니다. 좌표가 있으면 선택한 구 안에서 약 5km 이내 가까운 순으로 골라옵니다. 소수점은 쉼표 대신 마침표도 됩니다.
              </p>
            </div>
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
      <HomeAccountDock />
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
        <img
          src={src!}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy={imgReferrerPolicyForResolvedSrc(src)}
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="food-photo-overlay-wrap__filler home-hub__photo-placeholder" aria-hidden />
      )}
    </FoodPhotoWithMenuOverlay>
  )
}
