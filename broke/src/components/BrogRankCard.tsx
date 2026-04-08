import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import type { RestaurantListItem } from '../api/restaurants'
import { FoodPhotoWithMenuOverlay } from './FoodPhotoWithMenuOverlay'
import { imgReferrerPolicyForResolvedSrc, resolveMediaUrl } from '../lib/mediaUrl'

/** BroG: 다이닝코드 랭킹형 — 주메뉴(대표) 사진 · 가게명 · 대표가격만 */
export function BrogRankCard({
  restaurant,
  rank,
  footer,
}: {
  restaurant: RestaurantListItem
  rank: number
  footer?: ReactNode
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const firstImg =
    restaurant.image_urls && restaurant.image_urls.length > 0
      ? restaurant.image_urls[0]
      : restaurant.image_url
  const heroSrc = resolveMediaUrl(firstImg)
  const showPhoto = Boolean(heroSrc) && !imgFailed
  const isPrimaryListing = restaurant.points_eligible !== false

  return (
    <article className="brog-rank-card">
      <div className="brog-rank-card__inner">
        <Link to={`/restaurants/${restaurant.id}`} className="brog-rank-card__link">
          <span className="brog-rank-card__rank">{rank}</span>
          <div
            className={
              showPhoto ? 'brog-rank-card__photo' : 'brog-rank-card__photo brog-rank-card__photo--placeholder'
            }
          >
            <FoodPhotoWithMenuOverlay
              menuName={restaurant.main_menu_name}
              priceKrw={restaurant.main_menu_price}
            >
              {showPhoto ? (
                <img
                  src={heroSrc}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  referrerPolicy={imgReferrerPolicyForResolvedSrc(heroSrc)}
                  onError={() => setImgFailed(true)}
                />
              ) : (
                <span className="food-photo-overlay-wrap__filler" aria-hidden />
              )}
            </FoodPhotoWithMenuOverlay>
          </div>
          <div className="brog-rank-card__body">
            <h4
              className={
                isPrimaryListing
                  ? 'brog-rank-card__name brog-rank-card__name--primary'
                  : 'brog-rank-card__name'
              }
            >
              {restaurant.name}
            </h4>
          </div>
        </Link>
        {footer ? <div className="brog-rank-card__footer">{footer}</div> : null}
      </div>
    </article>
  )
}
