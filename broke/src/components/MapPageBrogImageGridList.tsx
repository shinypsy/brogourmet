import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import type { RestaurantListItem } from '../api/restaurants'
import { FoodPhotoWithMenuOverlay } from './FoodPhotoWithMenuOverlay'
import { firstRestaurantListImageUrl, imgReferrerPolicyForResolvedSrc, resolveMediaUrl } from '../lib/mediaUrl'

export function MapPageBrogImageThumb({ restaurant }: { restaurant: RestaurantListItem }) {
  const [failed, setFailed] = useState(false)
  const src = resolveMediaUrl(firstRestaurantListImageUrl(restaurant))
  const showImg = Boolean(src) && !failed

  return (
    <span className="map-page-brog-image-grid__thumb">
      <FoodPhotoWithMenuOverlay
        menuName={restaurant.main_menu_name}
        priceKrw={restaurant.main_menu_price}
        compact
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
          <span className="food-photo-overlay-wrap__filler map-page-brog-image-grid__thumb-filler" aria-hidden />
        )}
      </FoodPhotoWithMenuOverlay>
      {restaurant.has_active_site_event ? (
        <span className="brog-list-event-badge map-page-brog-image-grid__event" aria-label="이벤트 진행 중">
          이벤트
        </span>
      ) : null}
    </span>
  )
}

export type MapPageBrogImageGridListProps = {
  items: RestaurantListItem[]
  getDetailHref: (r: RestaurantListItem) => string
  /** 기본: 순번 index+1. BroG는 `bro_list_pin` 우선 등 호출부에서 지정 */
  getRankDisplay?: (r: RestaurantListItem, index: number) => number
  /** meta에 관리자 고정 1~4 태그(BroG) */
  showBroListPinMeta?: boolean
  renderActions?: (r: RestaurantListItem) => ReactNode
  gridClassName?: string
}

export function MapPageBrogImageGridList({
  items,
  getDetailHref,
  getRankDisplay = (_, i) => i + 1,
  showBroListPinMeta = false,
  renderActions,
  gridClassName = 'map-page-brog-image-grid map-page-brog-image-grid--main-4x2',
}: MapPageBrogImageGridListProps) {
  return (
    <ul className={gridClassName}>
      {items.map((restaurant, index) => {
        const displayRank = getRankDisplay(restaurant, index)
        const pin = restaurant.bro_list_pin
        const nameClass =
          restaurant.points_eligible !== false
            ? 'map-page-brog-image-grid__name'
            : 'map-page-brog-image-grid__name map-page-brog-image-grid__name--secondary'
        const actions = renderActions?.(restaurant)
        return (
          <li key={restaurant.id} className="map-page-brog-image-grid__item">
            <Link
              to={getDetailHref(restaurant)}
              className="map-page-brog-image-grid__link"
              aria-label={`${restaurant.name} 상세 보기`}
            >
              <span className="map-page-brog-image-grid__rank" aria-hidden>
                {displayRank}
              </span>
              <MapPageBrogImageThumb restaurant={restaurant} />
              <span className={nameClass}>{restaurant.name}</span>
              <span className="map-page-brog-image-grid__meta">
                {restaurant.district} · {restaurant.category}
                {showBroListPinMeta && pin != null && pin >= 1 && pin <= 4 ? (
                  <span className="map-page-brog-image-grid__tag"> 고정{pin}</span>
                ) : null}
                {restaurant.is_franchise ? (
                  <span className="map-page-brog-image-grid__tag map-page-brog-image-grid__tag--franchise">
                    {' '}
                    가맹
                  </span>
                ) : null}
              </span>
            </Link>
            {actions ? <div className="map-page-brog-image-grid__actions">{actions}</div> : null}
          </li>
        )
      })}
    </ul>
  )
}
