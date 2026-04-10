import type { ReactNode } from 'react'

type Props = {
  menuName: string
  priceKrw: number
  /** 이미지 또는 플레이스홀더 래퍼 */
  children: ReactNode
  className?: string
  /** 갤러리 썸네일 등 작은 영역 */
  compact?: boolean
}

/**
 * BroG 등 음식 사진 하단에 대표 메뉴명·가격을 항상 겹쳐 표시
 */
export function FoodPhotoWithMenuOverlay({
  menuName,
  priceKrw,
  children,
  className = '',
  compact = false,
}: Props) {
  const name = String(menuName ?? '')
    .trim()
    .replace(/\s+/g, ' ') || '대표 메뉴'
  const safePrice = typeof priceKrw === 'number' && Number.isFinite(priceKrw) ? priceKrw : 0
  const priceLabel = `${Math.max(0, safePrice).toLocaleString()}원 이하`

  return (
    <div
      className={`food-photo-overlay-wrap${compact ? ' food-photo-overlay-wrap--compact' : ''} ${className}`.trim()}
    >
      {children}
      <div className="food-photo-overlay-wrap__caption">
        <span className="food-photo-overlay-wrap__menu">{name}</span>
        <span className="food-photo-overlay-wrap__price">{priceLabel}</span>
      </div>
    </div>
  )
}
